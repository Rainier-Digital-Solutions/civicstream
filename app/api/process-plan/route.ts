import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan } from '@/lib/openai';
import { chunkPDF } from '@/lib/pdf-utils';
import { del } from '@vercel/blob';
import * as vercelBlob from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_MS = 300000; // 5 minutes
const BATCH_SIZE = 5;

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

            // Process the PDF in chunks
            const chunks = await chunkPDF(Buffer.from(buffer));
            console.log(`[ProcessPlan] Split PDF into ${chunks.length} chunks`);

            const results = [];

            for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batchChunks = chunks.slice(i, i + BATCH_SIZE);
                console.log(`[ProcessPlan] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)}`);

                // Combine chunks in this batch
                const batchBase64 = batchChunks.map(chunk => chunk.base64).join('\n\n');

                const projectDetails = {
                    address,
                    parcelNumber,
                    city,
                    county,
                    projectSummary: projectSummary || undefined
                };

                try {
                    const reviewResult = await reviewArchitecturalPlan(batchBase64, projectDetails);
                    results.push(reviewResult);

                    console.log(`[ProcessPlan] Batch ${Math.floor(i / BATCH_SIZE) + 1} review completed:`, {
                        isCompliant: reviewResult.isCompliant,
                        totalFindings: reviewResult.totalFindings
                    });
                } catch (error) {
                    console.error(`[ProcessPlan] Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
                    throw error;
                }
            }

            // Combine results from all batches
            const combinedResult = {
                summary: results.map(r => r.summary).join('\n\n'),
                criticalFindings: results.flatMap(r => r.criticalFindings),
                majorFindings: results.flatMap(r => r.majorFindings),
                minorFindings: results.flatMap(r => r.minorFindings),
                totalFindings: results.reduce((sum, r) => sum + r.totalFindings, 0),
                isCompliant: results.every(r => r.isCompliant),
                cityPlannerEmailBody: results.map(r => r.cityPlannerEmailBody).join('\n\n'),
                submitterEmailBody: results.map(r => r.submitterEmailBody).join('\n\n')
            };

            console.log('[ProcessPlan] All batches processed:', {
                isCompliant: combinedResult.isCompliant,
                totalFindings: combinedResult.totalFindings
            });

            // Send email using the email endpoint
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
            console.log('[ProcessPlan] Attempting to send email:', {
                baseUrl,
                submitterEmail,
                cityPlannerEmail,
                isCompliant: combinedResult.isCompliant
            });

            const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reviewResult: combinedResult,
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