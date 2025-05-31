import { NextRequest, NextResponse } from 'next/server';
import {
    reviewArchitecturalPlan,
    extractPlanMetadata,
    reviewWithMetadata,
    PlanMetadata,
    reviewPlanWithResponsesAPI
} from '@/lib/openai';
import {
    reviewPlanWithClaude,
    extractPlanMetadataWithClaude,
    reviewWithMetadataWithClaude,
    PlanMetadata as ClaudePlanMetadata
} from '@/lib/claude';
import { chunkPDF } from '@/lib/pdf-utils';
import { del } from '@vercel/blob';
import * as vercelBlob from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes (Vercel Pro plan limit)

const TIMEOUT_MS = 600000; // 10 minutes
const BATCH_SIZE = 5;
const MAX_SINGLE_REQUEST_SIZE = 2000000; // Maximum size in bytes for single request (~2MB)
const VERCEL_MEMORY_SAFE_LIMIT = 40 * 1024 * 1024; // 40MB Vercel memory safe limit (tune as needed)

// Helper function to get memory usage
function getMemoryUsage() {
    const used = process.memoryUsage();
    return {
        rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(used.external / 1024 / 1024)}MB`,
    };
}

// Helper function for structured logging
function logWithContext(level: string, message: string, context: any = {}) {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
        timestamp,
        level,
        message,
        memory: getMemoryUsage(),
        ...context
    }));
}

// Helper to check environment variables
function validateEnvironment() {
    const issues: string[] = [];
    const envVars: Record<string, string | undefined> = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
        BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
        SERPAPI_API_KEY: process.env.SERPAPI_API_KEY
    };

    // Critical environment variables
    const criticalVars = ['NEXT_PUBLIC_API_BASE_URL', 'BLOB_READ_WRITE_TOKEN', 'ANTHROPIC_API_KEY'];
    const optionalVars = ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'SERPAPI_API_KEY'];

    criticalVars.forEach(key => {
        if (!envVars[key]) {
            issues.push(`${key} is missing (critical)`);
        }
    });

    const warnings: string[] = [];
    optionalVars.forEach(key => {
        if (!envVars[key]) {
            warnings.push(`${key} is missing (optional)`);
        }
    });

    return {
        isValid: issues.length === 0,
        issues,
        warnings,
        envVars: Object.keys(envVars).reduce<Record<string, string | undefined>>((acc, key) => ({
            ...acc,
            [key]: envVars[key] ? `${envVars[key]?.substring(0, 4)}...${envVars[key]?.substring(envVars[key]!.length - 4)}` : undefined
        }), {})
    };
}

export async function POST(req: NextRequest) {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    logWithContext('info', 'Received process plan request', { requestId });

    try {
        // Validate environment variables first
        const envCheck = validateEnvironment();
        logWithContext('info', 'Environment check completed', {
            requestId,
            isValid: envCheck.isValid,
            issues: envCheck.issues,
            warnings: envCheck.warnings,
            envVars: envCheck.envVars
        });

        if (!envCheck.isValid) {
            logWithContext('error', 'Environment issues detected', {
                requestId,
                issues: envCheck.issues
            });
        }

        // Parse the request body
        const body = await req.json();
        logWithContext('info', 'Request body parsed', {
            requestId,
            bodySize: JSON.stringify(body).length,
            hasBlobUrl: !!body.blobUrl,
            blobUrlLength: body.blobUrl?.length
        });

        // Start background processing without awaiting
        logWithContext('info', 'Starting background processing', {
            requestId,
            processingTime: `${Date.now() - startTime}ms`
        });

        // Fire and forget - start processing in background
        processSubmission(body, requestId).catch(error => {
            logWithContext('error', 'Background processing failed', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
        });

        logWithContext('info', 'Background processing initiated', {
            requestId,
            responseTime: `${Date.now() - startTime}ms`
        });

        // Return immediately while processing continues in background
        return NextResponse.json({
            success: true,
            message: "Processing started in background. You will receive results via email once complete.",
            requestId
        });

    } catch (error) {
        logWithContext('error', 'Error in process plan request', {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            processingTime: `${Date.now() - startTime}ms`
        });

        return NextResponse.json(
            { success: false, error: 'Failed to process request: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
}

async function processSubmission(body: any, requestId: string) {
    const startTime = Date.now();
    logWithContext('info', 'Starting plan processing', { requestId });

    try {
        const {
            blobUrl,
            submitterEmail,
            cityPlannerEmail,
            address,
            parcelNumber,
            city,
            county,
            projectSummary,
            useClaude = true // Optional parameter to use Claude instead of OpenAI (default: true)
        } = body;

        logWithContext('info', 'Extracted request parameters', {
            requestId,
            hasBlobUrl: !!blobUrl,
            blobUrlLength: blobUrl?.length,
            hasSubmitterEmail: !!submitterEmail,
            hasCityPlannerEmail: !!cityPlannerEmail,
            hasAddress: !!address,
            hasParcelNumber: !!parcelNumber,
            hasCity: !!city,
            hasCounty: !!county,
            hasProjectSummary: !!projectSummary,
            useClaude
        });

        if (!blobUrl) {
            logWithContext('error', 'Missing blobUrl parameter', { requestId });
            return;
        }

        // Validate required fields
        const missingFields = [];
        if (!submitterEmail) missingFields.push('submitterEmail');
        if (!cityPlannerEmail) missingFields.push('cityPlannerEmail');
        if (!address) missingFields.push('address');
        if (!parcelNumber) missingFields.push('parcelNumber');
        if (!city) missingFields.push('city');
        if (!county) missingFields.push('county');

        if (missingFields.length > 0) {
            logWithContext('error', 'Missing required fields', {
                requestId,
                missingFields
            });
            return;
        }

        // Fetch the file from Blob
        logWithContext('info', 'Fetching file from Blob', {
            requestId,
            blobUrl: blobUrl.substring(0, 50) + '...'
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const fetchStartTime = Date.now();
            const response = await fetch(blobUrl, {
                signal: controller.signal,
            });

            logWithContext('info', 'Blob fetch completed', {
                requestId,
                status: response.status,
                fetchTime: `${Date.now() - fetchStartTime}ms`
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            logWithContext('info', 'Response buffer read', {
                requestId,
                bufferSize: buffer.byteLength,
                memory: getMemoryUsage()
            });

            clearTimeout(timeoutId);

            const projectDetails = {
                address,
                parcelNumber,
                city,
                county,
                projectSummary: projectSummary || undefined
            };

            let reviewResult;
            const pdfBuffer = Buffer.from(buffer);
            const fileName = new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf';

            if (pdfBuffer.byteLength <= VERCEL_MEMORY_SAFE_LIMIT) {
                logWithContext('info', 'Processing PDF within memory limit', {
                    requestId,
                    pdfSize: pdfBuffer.byteLength,
                    memoryLimit: VERCEL_MEMORY_SAFE_LIMIT
                });

                try {
                    const reviewStartTime = Date.now();

                    if (useClaude) {
                        logWithContext('info', 'Using Claude API for PDF review', { 
                            requestId,
                            anthropicKeyPresent: !!process.env.ANTHROPIC_API_KEY,
                            perplexityKeyPresent: !!process.env.PERPLEXITY_API_KEY,
                            serpApiKeyPresent: !!process.env.SERPAPI_API_KEY
                        });
                        try {
                            reviewResult = await reviewPlanWithClaude(pdfBuffer, fileName, projectDetails);
                            logWithContext('info', 'Claude API call completed successfully', { requestId });
                        } catch (claudeError) {
                            logWithContext('error', 'Claude API call failed', {
                                requestId,
                                error: claudeError instanceof Error ? claudeError.message : 'Unknown error',
                                stack: claudeError instanceof Error ? claudeError.stack : undefined
                            });
                            throw claudeError;
                        }
                    } else {
                        logWithContext('info', 'Using OpenAI Responses API for PDF review', { requestId });
                        reviewResult = await reviewPlanWithResponsesAPI(pdfBuffer, fileName, projectDetails);
                    }

                    logWithContext('info', 'PDF review completed', {
                        requestId,
                        reviewTime: `${Date.now() - reviewStartTime}ms`,
                        isCompliant: reviewResult.isCompliant,
                        totalFindings: reviewResult.totalFindings,
                        hasEmailBody: !!reviewResult.submitterEmailBody,
                        usedClaude: useClaude
                    });

                } catch (error) {
                    logWithContext('error', 'Error in PDF review', {
                        requestId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined
                    });

                    // Fall back to chunking
                    logWithContext('info', 'Falling back to chunking approach', { requestId });
                    const chunks = await chunkPDF(pdfBuffer);

                    logWithContext('info', 'PDF chunking completed', {
                        requestId,
                        numChunks: chunks.length,
                        memory: getMemoryUsage()
                    });

                    // Process chunks in batches
                    const metadataResults: PlanMetadata[] = [];
                    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                        const batchStartTime = Date.now();
                        const batchChunks = chunks.slice(i, i + BATCH_SIZE);

                        logWithContext('info', 'Processing metadata batch', {
                            requestId,
                            batchNumber: Math.floor(i / BATCH_SIZE) + 1,
                            totalBatches: Math.ceil(chunks.length / BATCH_SIZE)
                        });

                        const batchPromises = batchChunks.map(chunk =>
                            useClaude ?
                                extractPlanMetadataWithClaude(chunk.content, projectDetails)
                                    .catch((e: Error) => {
                                        logWithContext('error', 'Error extracting metadata from chunk with Claude', {
                                            requestId,
                                            error: e.message,
                                            stack: e.stack
                                        });
                                        return null;
                                    }) :
                                extractPlanMetadata(chunk.base64, projectDetails)
                                    .catch((e: Error) => {
                                        logWithContext('error', 'Error extracting metadata from chunk with OpenAI', {
                                            requestId,
                                            error: e.message,
                                            stack: e.stack
                                        });
                                        return null;
                                    })
                        );

                        const batchResults = await Promise.all(batchPromises);
                        metadataResults.push(...batchResults.filter(Boolean) as PlanMetadata[]);

                        logWithContext('info', 'Batch processing completed', {
                            requestId,
                            batchTime: `${Date.now() - batchStartTime}ms`,
                            successfulResults: batchResults.filter(Boolean).length
                        });
                    }

                    const reviewStartTime = Date.now();

                    if (useClaude) {
                        reviewResult = await reviewWithMetadataWithClaude(metadataResults as ClaudePlanMetadata[], projectDetails);
                    } else {
                        reviewResult = await reviewWithMetadata(metadataResults, projectDetails);
                    }

                    logWithContext('info', 'Metadata review completed', {
                        requestId,
                        reviewTime: `${Date.now() - reviewStartTime}ms`,
                        isCompliant: reviewResult.isCompliant,
                        totalFindings: reviewResult.totalFindings,
                        usedClaude: useClaude
                    });
                }
            } else {
                logWithContext('info', 'PDF exceeds memory limit, using chunking approach', {
                    requestId,
                    pdfSize: pdfBuffer.byteLength,
                    memoryLimit: VERCEL_MEMORY_SAFE_LIMIT
                });

                const chunks = await chunkPDF(pdfBuffer);
                logWithContext('info', 'PDF chunking completed', {
                    requestId,
                    numChunks: chunks.length,
                    memory: getMemoryUsage()
                });

                // Process chunks in batches
                const metadataResults: PlanMetadata[] = [];
                for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                    const batchStartTime = Date.now();
                    const batchChunks = chunks.slice(i, i + BATCH_SIZE);

                    logWithContext('info', 'Processing metadata batch', {
                        requestId,
                        batchNumber: Math.floor(i / BATCH_SIZE) + 1,
                        totalBatches: Math.ceil(chunks.length / BATCH_SIZE)
                    });

                    const batchPromises = batchChunks.map(chunk =>
                        useClaude ?
                            extractPlanMetadataWithClaude(chunk.content, projectDetails)
                                .catch((error: Error) => {
                                    logWithContext('error', 'Error extracting metadata from chunk with Claude', {
                                        requestId,
                                        error: error.message,
                                        stack: error.stack
                                    });
                                    return null;
                                }) :
                            extractPlanMetadata(chunk.base64, projectDetails)
                                .catch((error: Error) => {
                                    logWithContext('error', 'Error extracting metadata from chunk with OpenAI', {
                                        requestId,
                                        error: error.message,
                                        stack: error.stack
                                    });
                                    return null;
                                })
                    );

                    const batchResults = await Promise.all(batchPromises);
                    metadataResults.push(...batchResults.filter(Boolean) as PlanMetadata[]);

                    logWithContext('info', 'Batch processing completed', {
                        requestId,
                        batchTime: `${Date.now() - batchStartTime}ms`,
                        successfulResults: batchResults.filter(Boolean).length
                    });
                }

                const reviewStartTime = Date.now();

                if (useClaude) {
                    logWithContext('info', 'Using Claude for metadata review', { 
                        requestId,
                        metadataCount: metadataResults.length 
                    });
                    try {
                        reviewResult = await reviewWithMetadataWithClaude(metadataResults as ClaudePlanMetadata[], projectDetails);
                        logWithContext('info', 'Claude metadata review completed successfully', { requestId });
                    } catch (claudeError) {
                        logWithContext('error', 'Claude metadata review failed', {
                            requestId,
                            error: claudeError instanceof Error ? claudeError.message : 'Unknown error',
                            stack: claudeError instanceof Error ? claudeError.stack : undefined
                        });
                        throw claudeError;
                    }
                } else {
                    reviewResult = await reviewWithMetadata(metadataResults, projectDetails);
                }

                logWithContext('info', 'Metadata review completed', {
                    requestId,
                    reviewTime: `${Date.now() - reviewStartTime}ms`,
                    isCompliant: reviewResult.isCompliant,
                    totalFindings: reviewResult.totalFindings,
                    usedClaude: useClaude
                });
            }

            // Send email
            logWithContext('info', 'Preparing to send email', { requestId });

            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
            const emailEndpoint = `${baseUrl}/api/send-email`;

            if (!reviewResult.submitterEmailBody || !reviewResult.cityPlannerEmailBody) {
                logWithContext('error', 'Missing email content', {
                    requestId,
                    hasSubmitterEmailBody: !!reviewResult.submitterEmailBody,
                    hasCityPlannerEmailBody: !!reviewResult.cityPlannerEmailBody
                });
                return;
            }

            try {
                const emailStartTime = Date.now();
                const emailResponse = await fetch(emailEndpoint, {
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

                logWithContext('info', 'Email API response received', {
                    requestId,
                    status: emailResponse.status,
                    emailTime: `${Date.now() - emailStartTime}ms`
                });

                if (!emailResponse.ok) {
                    let errorMessage = emailResponse.statusText;
                    try {
                        const errorData = await emailResponse.json();
                        logWithContext('error', 'Email sending failed', {
                            requestId,
                            status: emailResponse.status,
                            error: errorData.error
                        });
                        errorMessage = errorData.error || errorMessage;
                    } catch (parseError) {
                        logWithContext('error', 'Could not parse error response', {
                            requestId,
                            error: parseError instanceof Error ? parseError.message : 'Unknown error'
                        });
                    }
                    throw new Error(`Failed to send email: ${errorMessage}`);
                }

            } catch (emailError) {
                logWithContext('error', 'Error sending email', {
                    requestId,
                    error: emailError instanceof Error ? emailError.message : 'Unknown error',
                    stack: emailError instanceof Error ? emailError.stack : undefined
                });
                throw new Error('Failed to send email: ' + (emailError instanceof Error ? emailError.message : 'Unknown error'));
            }

            // Clean up the Blob
            try {
                const deleteStartTime = Date.now();
                await del(blobUrl);
                logWithContext('info', 'Blob deleted successfully', {
                    requestId,
                    deleteTime: `${Date.now() - deleteStartTime}ms`
                });
            } catch (error) {
                if (error instanceof vercelBlob.BlobRequestAbortedError) {
                    logWithContext('error', 'Blob deletion was aborted', { requestId });
                } else {
                    logWithContext('error', 'Error deleting blob', {
                        requestId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined
                    });
                }
            }

            logWithContext('info', 'Processing completed successfully', {
                requestId,
                totalProcessingTime: `${Date.now() - startTime}ms`
            });

        } catch (error) {
            logWithContext('error', 'Error in blob processing', {
                requestId,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    } catch (error) {
        logWithContext('error', 'Error in submission processing', {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            totalProcessingTime: `${Date.now() - startTime}ms`
        });
        throw error;
    }
} 