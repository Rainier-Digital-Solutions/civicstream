import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Test data for the API
const TEST_DATA = {
    submitterEmail: "test@example.com",
    cityPlannerEmail: "cityplanner@example.com",
    address: "123 Test Street, Seattle, WA 98101",
    parcelNumber: "123456-7890",
    city: "Seattle",
    county: "King County",
    projectSummary: "Test project for Responses API prototype"
};

/**
 * Test route to verify the Responses API prototype
 * This will test the prototype using a sample PDF and the new route
 */
export async function GET(req: NextRequest) {
    try {
        console.log('[Test] Starting Responses API test');

        // Try to get a sample PDF from the public directory
        let pdfPath = path.join(process.cwd(), 'public', 'sample-plans.pdf');
        let pdfBuffer: Buffer;

        try {
            pdfBuffer = await fs.readFile(pdfPath);
            console.log('[Test] Found sample PDF:', pdfPath);
        } catch (error) {
            console.error('[Test] Could not find sample PDF, creating test file...');

            // Create a minimal test PDF for testing (just a few bytes)
            pdfBuffer = Buffer.from(
                '%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n3 0 obj\n<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer\n<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF',
                'utf-8'
            );
        }

        // Convert PDF to FormData
        const formData = new FormData();
        formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), 'sample-plans.pdf');

        // Add test data
        Object.entries(TEST_DATA).forEach(([key, value]) => {
            formData.append(key, value);
        });

        // Call the Responses API route
        console.log('[Test] Calling plan-review-responses API');
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

        try {
            const response = await fetch(`${baseUrl}/api/plan-review-responses`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            return NextResponse.json({
                success: true,
                testResult: result,
                message: 'Responses API test completed'
            });
        } catch (error) {
            console.error('[Test] Error calling Responses API:', error);
            return NextResponse.json(
                {
                    error: 'Test failed: Error calling Responses API',
                    details: error instanceof Error ? error.message : 'Unknown error'
                },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('[Test] Test execution failed:', error);
        return NextResponse.json(
            { error: 'Test execution failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
            { status: 500 }
        );
    }
} 