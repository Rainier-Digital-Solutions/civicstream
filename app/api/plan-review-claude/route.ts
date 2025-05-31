import { NextRequest, NextResponse } from 'next/server';
import { reviewPlanWithClaude } from '@/lib/claude';
import { del } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_MS = 300000; // 5 minutes

export async function POST(req: NextRequest) {
    console.log('[Claude-API] Received plan review request');

    try {
        // Support both form data upload and blobUrl from existing upload
        if (req.headers.get('content-type')?.includes('multipart/form-data')) {
            return handleDirectUpload(req);
        } else {
            return handleBlobUrlUpload(req);
        }
    } catch (error) {
        console.error('[Claude-API] Error handling request:', error);
        return NextResponse.json(
            { error: 'Failed to process request: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
}

/**
 * Handle direct file upload via multipart/form-data
 */
async function handleDirectUpload(req: NextRequest) {
    try {
        const formData = await req.formData();

        // Extract file
        const file = formData.get('file') as File;
        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate content type
        if (!file.type.startsWith('application/pdf')) {
            return NextResponse.json(
                { error: 'Only PDF files are allowed' },
                { status: 400 }
            );
        }

        // Extract project details
        const submitterEmail = formData.get('submitterEmail') as string;
        const cityPlannerEmail = formData.get('cityPlannerEmail') as string;
        const address = formData.get('address') as string;
        const parcelNumber = formData.get('parcelNumber') as string;
        const city = formData.get('city') as string;
        const county = formData.get('county') as string;
        const projectSummary = formData.get('projectSummary') as string | null;

        if (!submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
            console.error('[Claude-API] Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Convert File to Buffer and then to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        const projectDetails = {
            address,
            parcelNumber,
            city,
            county,
            projectSummary: projectSummary || undefined
        };

        // Call Claude API function
        console.log('[Claude-API] Processing PDF with Claude API');
        const reviewResult = await reviewPlanWithClaude(
            buffer,
            file.name,
            projectDetails
        );

        console.log('[Claude-API] Review completed:', {
            isCompliant: reviewResult.isCompliant,
            totalFindings: reviewResult.totalFindings
        });

        // Send email using the existing email endpoint
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
        console.log('[Claude-API] Sending email:', {
            baseUrl,
            submitterEmail,
            cityPlannerEmail,
            isCompliant: reviewResult.isCompliant
        });

        const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reviewResult,
                blobUrl: null, // Since we have no blob URL in this case
                fileName: file.name,
                submitterEmail,
                cityPlannerEmail,
                // Include the file directly as base64
                fileBase64: base64
            }),
        });

        if (!emailResponse.ok) {
            console.error('[Claude-API] Failed to send email:', {
                status: emailResponse.status,
                statusText: emailResponse.statusText
            });
            return NextResponse.json(
                { error: 'Failed to send email' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            isCompliant: reviewResult.isCompliant,
            totalFindings: reviewResult.totalFindings
        });
    } catch (error) {
        console.error('[Claude-API] Error in direct upload handling:', error);
        return NextResponse.json(
            { error: 'Failed to process direct upload: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
}

/**
 * Handle uploads that reference an existing Blob URL
 * This reuses the existing upload flow with the Blob storage
 */
async function handleBlobUrlUpload(req: NextRequest) {
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
            console.error('[Claude-API] Missing blobUrl');
            return NextResponse.json(
                { error: 'Missing blobUrl' },
                { status: 400 }
            );
        }

        if (!submitterEmail || !cityPlannerEmail || !address || !parcelNumber || !city || !county) {
            console.error('[Claude-API] Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Fetch the file from Blob
        console.log('[Claude-API] Fetching file from Blob:', blobUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(blobUrl, {
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            clearTimeout(timeoutId);

            const fileName = new URL(blobUrl).pathname.split('/').pop() || 'plan.pdf';

            const projectDetails = {
                address,
                parcelNumber,
                city,
                county,
                projectSummary: projectSummary || undefined
            };

            // Call Claude API function
            console.log('[Claude-API] Processing PDF with Claude API');
            const reviewResult = await reviewPlanWithClaude(
                buffer,
                fileName,
                projectDetails
            );

            console.log('[Claude-API] Review completed:', {
                isCompliant: reviewResult.isCompliant,
                totalFindings: reviewResult.totalFindings
            });

            // Send email using the existing email endpoint
            const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
            console.log('[Claude-API] Sending email:', {
                baseUrl,
                submitterEmail,
                cityPlannerEmail,
                isCompliant: reviewResult.isCompliant
            });

            const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reviewResult,
                    blobUrl: blobUrl,
                    fileName,
                    submitterEmail,
                    cityPlannerEmail,
                }),
            });

            if (!emailResponse.ok) {
                console.error('[Claude-API] Failed to send email:', {
                    status: emailResponse.status,
                    statusText: emailResponse.statusText
                });
                return NextResponse.json(
                    { error: 'Failed to send email' },
                    { status: 500 }
                );
            }

            // Clean up the Blob
            try {
                await del(blobUrl);
                console.log('[Claude-API] Blob deleted:', blobUrl);
            } catch (error) {
                console.error('[Claude-API] Error deleting blob:', error);
            }

            return NextResponse.json({
                success: true,
                isCompliant: reviewResult.isCompliant,
                totalFindings: reviewResult.totalFindings
            });
        } catch (error) {
            console.error('[Claude-API] Error fetching or processing file:', error);
            return NextResponse.json(
                { error: 'Failed to fetch or process file: ' + (error instanceof Error ? error.message : 'Unknown error') },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[Claude-API] Error in blob URL handling:', error);
        return NextResponse.json(
            { error: 'Failed to process blob URL: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
}