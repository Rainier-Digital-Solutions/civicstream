import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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

    // Instead of processing here, send to the background process endpoint
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const processPlanUrl = `${baseUrl}/api/process-plan`;

    console.log(`[API] Attempting to trigger background processing at: ${processPlanUrl}`);

    // Fire and forget - don't await this promise
    fetch(processPlanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blobUrl,
        submitterEmail,
        cityPlannerEmail,
        address,
        parcelNumber,
        city,
        county,
        projectSummary
      }),
    })
      .then(response => {
        // Log basic response info even for fire-and-forget for debugging
        console.log(`[API] Background process trigger HTTP status: ${response.status}`);
        if (!response.ok) {
          response.text().then(text => {
            console.error(`[API] Background process trigger failed with status ${response.status}: ${text}`);
          }).catch(err => {
            console.error(`[API] Background process trigger failed with status ${response.status}, and couldn't parse error text: ${err}`);
          });
        }
      })
      .catch(error => {
        console.error(`[API] Error triggering background processing fetch for URL ${processPlanUrl}:`, error);
      });

    console.log('[API] Submission accepted and background processing started (fetch initiated).');

    // Return success immediately
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error processing submission:', error);
    return NextResponse.json(
      { error: 'Failed to process submission: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}