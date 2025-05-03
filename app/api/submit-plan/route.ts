import { NextRequest, NextResponse } from 'next/server';
import { reviewArchitecturalPlan } from '@/lib/openai';
import { routeReviewResults } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    console.log('Received plan submission request');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const submitterEmail = formData.get('submitterEmail') as string;
    const cityPlannerEmail = formData.get('cityPlannerEmail') as string;

    if (!file || !submitterEmail || !cityPlannerEmail) {
      console.error('Missing required fields:', { file: !!file, submitterEmail, cityPlannerEmail });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Processing submission:', {
      fileName: file.name,
      fileSize: file.size,
      submitterEmail,
      cityPlannerEmail
    });

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Convert buffer to base64 for OpenAI API
    const base64Pdf = buffer.toString('base64');

    console.log('Sending to OpenAI for review');

    // Send to OpenAI for review
    const reviewResult = await reviewArchitecturalPlan(base64Pdf);

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