import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan } from '@/lib/openai';
import { routeReviewResults } from '@/lib/email';
import { chunkPDF } from '@/lib/pdf-utils';
import { del, list, put } from '@vercel/blob';
import * as vercelBlob from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const config = {
  api: {
    responseLimit: '50mb',
  },
}

function logMemoryUsage() {
  const used = process.memoryUsage();
  console.log('[API] Memory usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(used.external / 1024 / 1024)}MB`,
  });
}

async function processSubmission(req: NextRequest) {
  console.log('[API] Received plan submission request');
  logMemoryUsage();

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
      console.log('[API] Starting fetch request...');
      console.log('[API] Environment:', process.env.NODE_ENV);
      console.log('[API] Vercel Environment:', process.env.VERCEL_ENV);

      let buffer: Buffer;

      const response = await fetch(blobUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/pdf',
          'Cache-Control': 'no-cache'
        },
        credentials: 'same-origin'
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('[API] Fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`Failed to fetch file from Blob: ${response.status} ${response.statusText}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/pdf')) {
        console.error('[API] Invalid content type:', contentType);
        throw new Error('Invalid content type: Expected PDF file');
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        throw new Error('Received empty file from Blob');
      }

      console.log('[API] Buffer size:', `${Math.round(buffer.length / 1024 / 1024)}MB`);

      // Chunk the PDF
      console.log('[API] Chunking PDF...');
      const chunks = await chunkPDF(buffer);
      console.log(`[API] PDF chunked into ${chunks.length} parts`);
      logMemoryUsage();

      // Process chunks in batches for OpenAI
      const BATCH_SIZE = 3; // Process 3 chunks at a time
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
          logMemoryUsage();
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
      logMemoryUsage();

      // Route the email based on the review results
      await routeReviewResults(
        combinedResult,
        buffer,
        new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf',
        submitterEmail,
        cityPlannerEmail
      );

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

export async function POST(req: NextRequest): Promise<Response> {
  // Process the submission asynchronously
  processSubmission(req).catch(error => {
    console.error('[API] Unhandled error in background processing:', error);
  });

  // Return immediately
  return NextResponse.json({ success: true });
}