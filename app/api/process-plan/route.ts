import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan, extractPlanMetadata, reviewWithMetadata, PlanMetadata } from '@/lib/openai';
import { chunkPDF } from '@/lib/pdf-utils';
import { del } from '@vercel/blob';
import * as vercelBlob from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_MS = 300000; // 5 minutes
const BATCH_SIZE = 5;
const MAX_SINGLE_REQUEST_SIZE = 2000000; // Maximum size in bytes for single request (~2MB)

export async function POST(req: NextRequest) {
    // Start the processing in the background without awaiting
    processSubmission(req).catch((error) => {
        console.error('[ProcessPlan] Unhandled error in background processing:', error);
    });

    // Return success immediately to the client
    return NextResponse.json({ success: true });
}

async function processSubmission(req: NextRequest) {
    console.log('[ProcessPlan] Starting background plan processing');

    try {
        const body = await req.json();
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

        if (!blobUrl) {
            console.error('[ProcessPlan] Missing blobUrl');
            return;
        }

        if (!submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
            console.error('[ProcessPlan] Missing required fields');
            return;
        }

        // Fetch the file from Blob
        console.log('[ProcessPlan] Fetching file from Blob:', blobUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(blobUrl, {
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            clearTimeout(timeoutId);

            const projectDetails = {
                address,
                parcelNumber,
                city,
                county,
                projectSummary: projectSummary || undefined
            };

            let reviewResult;

            // Check if we can process the entire PDF at once
            if (buffer.byteLength <= MAX_SINGLE_REQUEST_SIZE) {
                console.log(`[ProcessPlan] Processing entire PDF in single request (${buffer.byteLength} bytes)`);
                const fullPdfBase64 = Buffer.from(buffer).toString('base64');

                try {
                    reviewResult = await reviewArchitecturalPlan(fullPdfBase64, projectDetails);
                    console.log('[ProcessPlan] Full PDF review completed:', {
                        isCompliant: reviewResult.isCompliant,
                        totalFindings: reviewResult.totalFindings
                    });
                } catch (error) {
                    console.error('[ProcessPlan] Error processing full PDF:', error);
                    throw error;
                }
            } else {
                // Process the PDF in chunks with a two-phase approach
                const chunks = await chunkPDF(Buffer.from(buffer));
                console.log(`[ProcessPlan] Split PDF into ${chunks.length} chunks (two-phase approach)`);

                // Phase 1: Extract metadata from all chunks
                console.log('[ProcessPlan] Phase 1: Extracting metadata from all chunks');
                const metadataResults: PlanMetadata[] = [];

                for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
                    console.log(`[ProcessPlan] Processing metadata batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)}`);

                    // Process chunks in parallel for metadata extraction
                    const batchPromises = batchChunks.map(chunk =>
                        extractPlanMetadata(chunk.base64, projectDetails)
                            .catch((error: Error) => {
                                console.error(`[ProcessPlan] Error extracting metadata from chunk:`, error);
                                return null;
                            })
                    );

                    const batchResults = await Promise.all(batchPromises);
                    metadataResults.push(...batchResults.filter(Boolean) as PlanMetadata[]);
                }

                // Phase 2: Process the consolidated metadata in a single request
                console.log('[ProcessPlan] Phase 2: Processing consolidated metadata');
                reviewResult = await reviewWithMetadata(metadataResults, projectDetails);

                console.log('[ProcessPlan] Two-phase review completed:', {
                    isCompliant: reviewResult.isCompliant,
                    totalFindings: reviewResult.totalFindings
                });
            }

            // Send email using the email endpoint
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
            console.log('[ProcessPlan] Attempting to send email:', {
                baseUrl,
                submitterEmail,
                cityPlannerEmail,
                isCompliant: reviewResult.isCompliant
            });

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
                    cityPlannerEmail,
                }),
            });

            console.log('[ProcessPlan] Email response received:', {
                status: emailResponse.status,
                statusText: emailResponse.statusText,
                ok: emailResponse.ok
            });

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

            // Clean up the Blob
            try {
                await del(blobUrl);
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