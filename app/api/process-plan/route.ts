import { NextRequest, NextResponse } from 'next/server';
import {
    reviewArchitecturalPlan,
    extractPlanMetadata,
    reviewWithMetadata,
    PlanMetadata,
    reviewPlanWithResponsesAPI
} from '@/lib/openai';
import { chunkPDF } from '@/lib/pdf-utils';
import { del } from '@vercel/blob';
import * as vercelBlob from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_MS = 300000; // 5 minutes
const BATCH_SIZE = 5;
const MAX_SINGLE_REQUEST_SIZE = 2000000; // Maximum size in bytes for single request (~2MB)
const VERCEL_MEMORY_SAFE_LIMIT = 40 * 1024 * 1024; // 40MB Vercel memory safe limit (tune as needed)

// Helper to check environment variables
function validateEnvironment() {
    const issues = [];

    if (!process.env.OPENAI_API_KEY) {
        issues.push('OPENAI_API_KEY is missing');
    }

    if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
        issues.push('NEXT_PUBLIC_API_BASE_URL is missing');
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        issues.push('BLOB_READ_WRITE_TOKEN may be missing (required for Vercel Blob operations)');
    }

    return {
        isValid: issues.length === 0,
        issues
    };
}

export async function POST(req: NextRequest) {
    console.log('[ProcessPlan] Received submission request');

    try {
        // Validate environment variables first
        const envCheck = validateEnvironment();
        if (!envCheck.isValid) {
            console.error('[ProcessPlan] Environment issues detected:', envCheck.issues);
        }

        // Parse the request to get an ID for tracking
        const body = await req.json();

        // Start the processing in the background without awaiting
        processSubmission(body).catch((error) => {
            console.error('[ProcessPlan] Unhandled error in background processing:', error);
        });

        // Return success immediately to the client
        console.log('[ProcessPlan] Returning success response to client, background processing started');
        return NextResponse.json({ success: true });
    } catch (parseError) {
        console.error('[ProcessPlan] Failed to parse request:', parseError);
        return NextResponse.json(
            { success: false, error: 'Failed to parse request' },
            { status: 400 }
        );
    }
}

async function processSubmission(body: any) {
    console.log('[ProcessPlan] Starting background plan processing');

    try {
        console.log('[ProcessPlan] Using parsed request body');

        const {
            blobUrl,
            submitterEmail,
            cityPlannerEmail,
            address,
            parcelNumber,
            city,
            county,
            projectSummary
        } = body;

        // Log the request parameters (without any sensitive information)
        console.log('[ProcessPlan] Request parameters:', {
            hasBlobUrl: !!blobUrl,
            blobUrlLength: blobUrl ? blobUrl.length : 0,
            hasSubmitterEmail: !!submitterEmail,
            hasCityPlannerEmail: !!cityPlannerEmail,
            hasAddress: !!address,
            hasParcelNumber: !!parcelNumber,
            hasCity: !!city,
            hasCounty: !!county,
            hasProjectSummary: !!projectSummary
        });

        if (!blobUrl) {
            console.error('[ProcessPlan] Missing blobUrl parameter');
            return;
        }

        if (!submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
            const missingFields = [];
            if (!submitterEmail) missingFields.push('submitterEmail');
            if (!cityPlannerEmail) missingFields.push('cityPlannerEmail');
            if (!address) missingFields.push('address');
            if (!parcelNumber) missingFields.push('parcelNumber');
            if (!city) missingFields.push('city');
            if (!county) missingFields.push('county');

            console.error(`[ProcessPlan] Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
            console.error('[ProcessPlan] OPENAI_API_KEY is not configured in environment variables');
            return;
        } else {
            console.log('[ProcessPlan] OPENAI_API_KEY is configured (length:', process.env.OPENAI_API_KEY.length, ')');
        }

        // Fetch the file from Blob
        console.log('[ProcessPlan] Fetching file from Blob:', blobUrl.substring(0, 50) + '...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            console.log('[ProcessPlan] Starting fetch request');
            const response = await fetch(blobUrl, {
                signal: controller.signal,
            });
            console.log('[ProcessPlan] Fetch response received, status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
            }

            console.log('[ProcessPlan] Reading response buffer');
            const buffer = await response.arrayBuffer();
            console.log('[ProcessPlan] Response buffer read successfully, size:', buffer.byteLength, 'bytes');
            clearTimeout(timeoutId);

            const projectDetails = {
                address,
                parcelNumber,
                city,
                county,
                projectSummary: projectSummary || undefined
            };

            let reviewResult;
            const pdfBuffer = Buffer.from(buffer); // Create buffer once
            const fileName = new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf';

            if (pdfBuffer.byteLength <= VERCEL_MEMORY_SAFE_LIMIT) {
                console.log(`[ProcessPlan] PDF size (${pdfBuffer.byteLength} bytes) is within Vercel memory safe limit (${VERCEL_MEMORY_SAFE_LIMIT} bytes). Attempting direct processing with Responses API.`);
                try {
                    console.log('[ProcessPlan] Starting PDF review with Responses API, file size:', pdfBuffer.length, 'bytes, filename:', fileName);

                    // Add a timeout for the Responses API call (optional, but good practice)
                    const responseApiTimeout = setTimeout(() => {
                        console.warn('[ProcessPlan] WARNING: Responses API call taking longer than 3 minutes for medium file.');
                    }, 180000); // 3 minutes, adjust as needed

                    reviewResult = await reviewPlanWithResponsesAPI(pdfBuffer, fileName, projectDetails);

                    clearTimeout(responseApiTimeout);
                    console.log('[ProcessPlan] Direct PDF review completed with Responses API:', {
                        isCompliant: reviewResult.isCompliant,
                        totalFindings: reviewResult.totalFindings,
                        hasEmailBody: !!reviewResult.submitterEmailBody
                    });
                } catch (error) {
                    console.error('[ProcessPlan] Error processing PDF with Responses API (even within memory limit):', error);
                    console.error('[ProcessPlan] Error details:', error instanceof Error ? error.stack : 'No stack trace available');

                    // Fall back to the legacy chunking implementation if the Responses API fails for a "safe-sized" file
                    console.log('[ProcessPlan] Falling back to legacy chunking implementation for "safe-sized" file.');
                    // Note: chunkPDF also receives the full pdfBuffer. It must be memory efficient.
                    const chunks = await chunkPDF(pdfBuffer);
                    console.log(`[ProcessPlan] Split PDF into ${chunks.length} chunks (fallback for medium file).`);

                    console.log('[ProcessPlan] Phase 1: Extracting metadata from all chunks (fallback)');
                    const metadataResults: PlanMetadata[] = [];
                    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
                        console.log(`[ProcessPlan] Processing metadata batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)} (fallback)`);
                        const batchPromises = batchChunks.map(chunk =>
                            extractPlanMetadata(chunk.base64, projectDetails)
                                .catch((e: Error) => {
                                    console.error(`[ProcessPlan] Error extracting metadata from chunk (fallback):`, e);
                                    return null;
                                })
                        );
                        const batchResults = await Promise.all(batchPromises);
                        metadataResults.push(...batchResults.filter(Boolean) as PlanMetadata[]);
                    }
                    console.log('[ProcessPlan] Phase 2: Processing consolidated metadata (fallback)');
                    reviewResult = await reviewWithMetadata(metadataResults, projectDetails);
                    console.log('[ProcessPlan] Fallback review completed:', {
                        isCompliant: reviewResult.isCompliant,
                        totalFindings: reviewResult.totalFindings
                    });
                }
            } else {
                // For very large PDFs, go directly to legacy chunking
                console.log(`[ProcessPlan] PDF size (${pdfBuffer.byteLength} bytes) exceeds Vercel memory safe limit (${VERCEL_MEMORY_SAFE_LIMIT} bytes). Using legacy chunking approach directly.`);
                // CRITICAL: chunkPDF must be memory efficient enough to handle pdfBuffer.byteLength here.
                // If chunkPDF itself loads the entire large file into memory for its operations, it might also fail.
                // Consider refactoring chunkPDF to use streaming input if issues persist for very large files.
                const chunks = await chunkPDF(pdfBuffer);
                console.log(`[ProcessPlan] Split PDF into ${chunks.length} chunks (large file path).`);

                // Phase 1: Extract metadata from all chunks
                console.log('[ProcessPlan] Phase 1: Extracting metadata from all chunks (large file path)');
                const metadataResults: PlanMetadata[] = [];

                for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
                    console.log(`[ProcessPlan] Processing metadata batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)} (large file path)`);
                    const batchPromises = batchChunks.map(chunk =>
                        extractPlanMetadata(chunk.base64, projectDetails)
                            .catch((error: Error) => {
                                console.error(`[ProcessPlan] Error extracting metadata from chunk (large file path):`, error);
                                return null;
                            })
                    );
                    const batchResults = await Promise.all(batchPromises);
                    metadataResults.push(...batchResults.filter(Boolean) as PlanMetadata[]);
                }

                // Phase 2: Process the consolidated metadata in a single request
                console.log('[ProcessPlan] Phase 2: Processing consolidated metadata (large file path)');
                reviewResult = await reviewWithMetadata(metadataResults, projectDetails);
                console.log('[ProcessPlan] Large PDF review via chunking completed:', {
                    isCompliant: reviewResult.isCompliant,
                    totalFindings: reviewResult.totalFindings
                });
            }

            // Send email using the email endpoint
            console.log('[ProcessPlan] Preparing to send email');

            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
            console.log('[ProcessPlan] Email endpoint URL:', `${baseUrl}/api/send-email`);

            // Check email content validity before sending
            if (!reviewResult.submitterEmailBody || !reviewResult.cityPlannerEmailBody) {
                console.error('[ProcessPlan] WARNING: Email bodies are missing or empty');
            }

            console.log('[ProcessPlan] Attempting to send email:', {
                baseUrl,
                submitterEmail,
                cityPlannerEmail,
                isCompliant: reviewResult.isCompliant,
                hasReviewResult: !!reviewResult,
                hasEmailBodies: !!(reviewResult.submitterEmailBody && reviewResult.cityPlannerEmailBody)
            });

            try {
                const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reviewResult,
                        blobUrl: blobUrl,
                        fileName: new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf',
                        submitterEmail,
                        cityPlannerEmail
                    }),
                });

                console.log('[ProcessPlan] Email API responded with status:', emailResponse.status);

                if (!emailResponse.ok) {
                    let errorMessage = emailResponse.statusText;
                    try {
                        const errorData = await emailResponse.json();
                        console.error('[ProcessPlan] Email sending failed:', {
                            status: emailResponse.status,
                            statusText: emailResponse.statusText,
                            error: errorData.error
                        });
                        errorMessage = errorData.error || errorMessage;
                    } catch (parseError) {
                        console.error('[ProcessPlan] Could not parse error response:', parseError);
                    }
                    throw new Error(`Failed to send email: ${errorMessage}`);
                }

                console.log('[ProcessPlan] Email sent successfully');
            } catch (emailError) {
                console.error('[ProcessPlan] Error sending email:', emailError);
                console.error('[ProcessPlan] Email error details:', emailError instanceof Error ? emailError.stack : 'No stack trace available');
                throw new Error('Failed to send email: ' + (emailError instanceof Error ? emailError.message : 'Unknown error'));
            }

            // Clean up the Blob
            try {
                await del(blobUrl);
                console.log('[ProcessPlan] Blob successfully deleted from storage');
            } catch (error) {
                if (error instanceof vercelBlob.BlobRequestAbortedError) {
                    console.error('[ProcessPlan] Blob deletion was aborted');
                } else {
                    console.error('[ProcessPlan] Error deleting blob:', error);
                }
            }

            console.log('[ProcessPlan] Background processing completed successfully');
        } catch (error) {
            console.error('[ProcessPlan] Error in background processing:', error);
        }
    } catch (error) {
        console.error('[ProcessPlan] Error parsing request:', error);
    }
} 