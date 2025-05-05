import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan } from '@/lib/openai';
import { routeReviewResults } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('[API] Received plan submission request');

  try {
    console.log('Received plan submission request');

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
    const submitterEmail = formData.get('submitterEmail') as string;
    const cityPlannerEmail = formData.get('cityPlannerEmail') as string;
    const address = formData.get('address') as string;
    const parcelNumber = formData.get('parcelNumber') as string;
    const city = formData.get('city') as string;
    const county = formData.get('county') as string;
    const projectSummary = formData.get('projectSummary') as string | null;

    if (!file || !submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
      console.error('Missing required fields:', {
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

    console.log('Processing submission:', {
      fileName: file.name,
      fileSize: file.size,
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

    // Convert buffer to base64 for OpenAI API
    const base64Pdf = buffer.toString('base64');

    console.log('Sending to OpenAI for review');

    // Send to OpenAI for review with project details
    const reviewResult = await reviewArchitecturalPlan(base64Pdf, {
      address,
      parcelNumber,
      city,
      county,
      projectSummary: projectSummary || undefined
    });

    console.log('Review completed:', {
      isCompliant: reviewResult.isCompliant,
      totalFindings: reviewResult.totalFindings
    });

    // Route the email based on the review results
    await routeReviewResults(
      reviewResult,
      buffer,
      file.name,
      submitterEmail,
      cityPlannerEmail
    );

    return NextResponse.json({
      success: true,
      isCompliant: reviewResult.isCompliant,
      totalFindings: reviewResult.totalFindings
    });
  } catch (error) {
    console.error('Error processing plan submission:', error);
    return NextResponse.json(
      { error: 'Failed to process submission' },
      { status: 500 }
    );
  }
}