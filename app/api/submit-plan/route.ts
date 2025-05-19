import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  logWithContext('info', 'Received plan submission request', { requestId });

  try {
    const startTime = Date.now();
    const formData = await req.formData();
    const blobUrl = formData.get('blobUrl') as string;

    logWithContext('info', 'Form data parsed', {
      requestId,
      hasBlobUrl: !!blobUrl,
      blobUrlLength: blobUrl?.length,
      formDataSize: JSON.stringify(Object.fromEntries(formData)).length,
      processingTime: `${Date.now() - startTime}ms`
    });
    
    if (!blobUrl) {
      logWithContext('error', 'Missing blobUrl', { requestId });
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

    logWithContext('info', 'Extracted form fields', {
      requestId,
      hasSubmitterEmail: !!submitterEmail,
      hasCityPlannerEmail: !!cityPlannerEmail,
      hasAddress: !!address,
      hasParcelNumber: !!parcelNumber,
      hasCity: !!city,
      hasCounty: !!county,
      hasProjectSummary: !!projectSummary
    });

    if (!submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
      const missingFields = [];
      if (!submitterEmail) missingFields.push('submitterEmail');
      if (!cityPlannerEmail) missingFields.push('cityPlannerEmail');
      if (!address) missingFields.push('address');
      if (!parcelNumber) missingFields.push('parcelNumber');
      if (!city) missingFields.push('city');
      if (!county) missingFields.push('county');

      logWithContext('error', 'Missing required fields', {
        requestId,
        missingFields
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
    const processPlanUrl = `${baseUrl}/api/process-plan`;

    logWithContext('info', 'Initiating background processing', {
      requestId,
      processPlanUrl,
      environment: process.env.NODE_ENV
    });

    try {
      const processStartTime = Date.now();
      const response = await fetch(processPlanUrl, {
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
      });

      const responseTime = Date.now() - processStartTime;
      logWithContext('info', 'Background process response received', {
        requestId,
        status: response.status,
        responseTime: `${responseTime}ms`
      });

      if (!response.ok) {
        const text = await response.text();
        logWithContext('error', 'Background process failed', {
          requestId,
          status: response.status,
          error: text
        });
      } else {
        const jsonResponse = await response.json();
        logWithContext('info', 'Background process initiated successfully', {
          requestId,
          response: jsonResponse
        });
      }
    } catch (error) {
      logWithContext('error', 'Error in background processing', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    logWithContext('info', 'Submission completed', {
      requestId,
      totalProcessingTime: `${Date.now() - startTime}ms`
    });
    logMemoryUsage();
    return NextResponse.json({ success: true });
  } catch (error) {
    logWithContext('error', 'Error processing submission', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to process submission: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}