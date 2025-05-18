import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan } from '@/lib/openai';
import { routeReviewResults } from '@/lib/email';
import { chunkPDF } from '@/lib/pdf-utils';

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
    console.log('[API] FormData received:', {
      hasFile: formData.has('file'),
      hasSubmitterEmail: formData.has('submitterEmail'),
      hasCityPlannerEmail: formData.has('cityPlannerEmail'),
      hasAddress: formData.has('address'),
      hasParcelNumber: formData.has('parcelNumber'),
      hasCity: formData.has('city'),
      hasCounty: formData.has('county')
    });

    const file = formData.get('file') as File | null;
    console.log('[API] File details:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileSizeMB: file ? (file.size / (1024 * 1024)).toFixed(2) : null,
      fileType: file?.type
    });

    const submitterEmail = formData.get('submitterEmail') as string;
    const cityPlannerEmail = formData.get('cityPlannerEmail') as string;
    const address = formData.get('address') as string;
    const parcelNumber = formData.get('parcelNumber') as string;
    const city = formData.get('city') as string;
    const county = formData.get('county') as string;
    const projectSummary = formData.get('projectSummary') as string | null;

    if (!file || !submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
      console.error('[API] Missing required fields:', {
        file: !!file,
        submitterEmail,
        cityPlannerEmail,
        address,
        parcelNumber,
        city,
        county
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Add size validation before processing
    if (file.size > 50 * 1024 * 1024) { // 50MB in bytes
      console.error('[API] File too large:', {
        fileName: file.name,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        maxSizeMB: 50
      });
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    console.log('[API] Processing submission:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      submitterEmail,
      cityPlannerEmail,
      address,
      parcelNumber,
      city,
      county,
      hasProjectSummary: !!projectSummary
    });

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    logMemoryUsage();

    // Chunk the PDF
    console.log('[API] Chunking PDF...');
    const chunks = await chunkPDF(buffer);
    console.log(`[API] PDF chunked into ${chunks.length} parts`);
    logMemoryUsage();

    // Process each chunk and combine results
    let combinedReviewResult = null;
    for (const chunk of chunks) {
      console.log(`[API] Processing chunk for pages ${chunk.pages.join(', ')}...`);

      // Use location info from chunk if available, otherwise use form data
      const chunkProjectDetails = {
        address: chunk.locationInfo?.address || address,
        parcelNumber: chunk.locationInfo?.parcelNumber || parcelNumber,
        city,
        county,
        projectSummary: projectSummary || undefined
      };

      try {
        // Send chunk to OpenAI for review
        const chunkReviewResult = await reviewArchitecturalPlan(chunk.base64, chunkProjectDetails);

        // Combine results
        if (!combinedReviewResult) {
          combinedReviewResult = chunkReviewResult;
        } else {
          // Merge findings
          combinedReviewResult.criticalFindings = [
            ...combinedReviewResult.criticalFindings,
            ...chunkReviewResult.criticalFindings
          ];
          combinedReviewResult.majorFindings = [
            ...combinedReviewResult.majorFindings,
            ...chunkReviewResult.majorFindings
          ];
          combinedReviewResult.minorFindings = [
            ...combinedReviewResult.minorFindings,
            ...chunkReviewResult.minorFindings
          ];
          combinedReviewResult.totalFindings += chunkReviewResult.totalFindings;

          // Update compliance status
          combinedReviewResult.isCompliant = combinedReviewResult.isCompliant && chunkReviewResult.isCompliant;

          // Combine summaries
          combinedReviewResult.summary = `${combinedReviewResult.summary}\n\nPages ${chunk.pages.join(', ')}:\n${chunkReviewResult.summary}`;
        }
      } catch (chunkError) {
        console.error(`[API] Error processing chunk for pages ${chunk.pages.join(', ')}:`, chunkError);
        // Continue with other chunks even if one fails
        continue;
      }
    }

    if (!combinedReviewResult) {
      throw new Error('Failed to process any PDF chunks');
    }

    console.log('[API] Review completed:', {
      isCompliant: combinedReviewResult.isCompliant,
      totalFindings: combinedReviewResult.totalFindings
    });
    logMemoryUsage();

    // Route the email based on the review results
    await routeReviewResults(
      combinedReviewResult,
      buffer,
      file.name,
      submitterEmail,
      cityPlannerEmail
    );

    return NextResponse.json({
      success: true,
      isCompliant: combinedReviewResult.isCompliant,
      totalFindings: combinedReviewResult.totalFindings
    });
  } catch (error) {
    console.error('[API] Error processing submission:', error);
    return NextResponse.json(
      { error: 'Failed to process submission: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Request timeout'));
    }, TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      processSubmission(req),
      timeoutPromise
    ]);
    return result;
  } catch (error) {
    console.error('[API] Error processing submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process submission' },
      { status: 500 }
    );
  }
}