import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan } from '@/lib/openai';
import { routeReviewResults } from '@/lib/email';
import { chunkPDF } from '@/lib/pdf-utils';
import { del } from '@vercel/blob';

export const dynamic = 'force-dynamic';
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
      const response = await fetch(blobUrl, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch file from Blob: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Chunk the PDF
      console.log('[API] Chunking PDF...');
      const chunks = await chunkPDF(buffer);
      console.log(`[API] PDF chunked into ${chunks.length} parts`);
      logMemoryUsage();

      // Combine all chunks into a single review request
      console.log('[API] Combining chunks for single review...');
      const combinedBase64 = chunks.map(chunk => chunk.base64).join('\n\n');

      const projectDetails = {
        address,
        parcelNumber,
        city,
        county,
        projectSummary: projectSummary || undefined
      };

      try {
        const reviewResult = await reviewArchitecturalPlan(combinedBase64, projectDetails);

        console.log('[API] Review completed:', {
          isCompliant: reviewResult.isCompliant,
          totalFindings: reviewResult.totalFindings
        });
        logMemoryUsage();

        // Route the email based on the review results
        await routeReviewResults(
          reviewResult,
          buffer,
          new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf',
          submitterEmail,
          cityPlannerEmail
        );

        // Clean up the Blob
        await del(blobUrl);

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