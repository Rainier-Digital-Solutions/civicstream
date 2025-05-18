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
  return processSubmission(req);
}

async function processSubmission(req: NextRequest) {
  console.log('[API] Received plan submission request');

  try {
    const formData = await req.formData();
    const blobUrl = formData.get('blobUrl') as string;

    if (!blobUrl) {
      console.error('[API] Missing blobUrl');
      return NextResponse.json(
        { error: 'Missing blobUrl' },
        { status: 400 }
      );
    }

    const submitterEmail = formData.get('submitterEmail') as string;
    const cityPlannerEmail = formData.get('cityPlannerEmail') as string;
    const address = formData.get('address') as string;
    const parcelNumber = formData.get('parcelNumber') as string;
    const city = formData.get('city') as string;
    const county = formData.get('county') as string;
    const projectSummary = formData.get('projectSummary') as string | null;

    if (!submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
      console.error('[API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch the file from Blob
    console.log('[API] Fetching file from Blob:', blobUrl);
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
      console.log(`[API] Split PDF into ${chunks.length} chunks`);

      const results = [];

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        console.log(`[API] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)}`);

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

          console.log(`[API] Batch ${Math.floor(i / BATCH_SIZE) + 1} review completed:`, {
            isCompliant: reviewResult.isCompliant,
            totalFindings: reviewResult.totalFindings
          });
        } catch (error) {
          console.error(`[API] Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
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

      console.log('[API] All batches processed:', {
        isCompliant: combinedResult.isCompliant,
        totalFindings: combinedResult.totalFindings
      });

      // Send email using the new email endpoint
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
      console.log('[API] Attempting to send email:', {
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
          pdfBuffer: Buffer.from(buffer).toString('base64'),
          fileName: new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf',
          submitterEmail,
          cityPlannerEmail,
        }),
      });

      console.log('[API] Email response received:', {
        status: emailResponse.status,
        statusText: emailResponse.statusText,
        ok: emailResponse.ok
      });

      if (!emailResponse.ok) {
        let errorMessage = emailResponse.statusText;
        try {
          const errorData = await emailResponse.json();
          console.error('[API] Email sending failed:', {
            status: emailResponse.status,
            statusText: emailResponse.statusText,
            error: errorData.error
          });
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('[API] Could not parse error response:', parseError);
        }
        throw new Error(`Failed to send email: ${errorMessage}`);
      }

      // Clean up the Blob
      try {
        await del(blobUrl);
      } catch (error) {
        if (error instanceof vercelBlob.BlobRequestAbortedError) {
          console.error('[API] Blob deletion was aborted');
        } else {
          console.error('[API] Error deleting blob:', error);
        }
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[API] Error processing submission:', error);
      return NextResponse.json(
        { error: 'Failed to process submission: ' + (error instanceof Error ? error.message : 'Unknown error') },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Error processing submission:', error);
    return NextResponse.json(
      { error: 'Failed to process submission: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}