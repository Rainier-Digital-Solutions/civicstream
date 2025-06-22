import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Initialize AWS clients
const region = process.env.AWS_REGION || 'us-west-2';

const dynamoClient = new DynamoDBClient({ region });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const s3 = new S3Client({ region });

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  // Variable declarations at the top for proper scope throughout the function
  let browser: any = null;
  let pdfBuffer: any = null;
  let reportFileName = '';

  try {
    // Get the submission ID from the URL params
    const pathParts = request.nextUrl.pathname.split('/');
    const submissionId = pathParts[pathParts.length - 1]; // Get the last part of the URL path

    // Get userId from query parameter for authentication
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - Missing userId' }, { status: 401 });
    }

    // Get the submission details from DynamoDB to verify ownership and get the S3 key
    const submissionResult = await dynamoDB.send(new GetCommand({
      TableName: process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions',
      Key: { submissionId },
    }));

    const submission = submissionResult.Item;

    // Check if submission exists and belongs to the authenticated user
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (submission.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized - Not your submission' }, { status: 403 });
    }

    // Log submission data for debugging
    console.log('=== START SUBMISSION DEBUG ===');
    console.log('Submission ID:', submissionId);
    console.log('Submission status:', submission.status);
    console.log('Submission keys:', Object.keys(submission));

    // Check if findings exist in the submission
    if (!submission.findings) {
      console.error('No findings data found in submission');
      return NextResponse.json({
        error: 'Findings not available yet. The analysis might still be in progress.',
        submissionStatus: submission.status
      }, { status: 400 });
    }

    // Log findings structure
    console.log('Findings keys:', Object.keys(submission.findings));

    // Define all possible finding types
    const findingTypes = [
      'criticalFindings', 'majorFindings', 'minorFindings',
      'missingPlans', 'missingPermits', 'missingDocumentation', 'missingInspectionCertificates'
    ];

    // Log counts for each finding type
    findingTypes.forEach(type => {
      const items = Array.isArray(submission.findings[type]) ? submission.findings[type] : [];
      console.log(`${type}:`, items.length, 'items');
    });

    // Ensure all expected arrays exist, even if empty
    const findings = {
      summary: submission.findings.summary || 'No summary available',
      criticalFindings: Array.isArray(submission.findings.criticalFindings) ?
        submission.findings.criticalFindings : [],
      majorFindings: Array.isArray(submission.findings.majorFindings) ?
        submission.findings.majorFindings : [],
      minorFindings: Array.isArray(submission.findings.minorFindings) ?
        submission.findings.minorFindings : [],
      missingPlans: Array.isArray(submission.findings.missingPlans) ?
        submission.findings.missingPlans : [],
      missingPermits: Array.isArray(submission.findings.missingPermits) ?
        submission.findings.missingPermits : [],
      missingDocumentation: Array.isArray(submission.findings.missingDocumentation) ?
        submission.findings.missingDocumentation : [],
      missingInspectionCertificates: Array.isArray(submission.findings.missingInspectionCertificates) ?
        submission.findings.missingInspectionCertificates : [],
      totalFindings: typeof submission.findings.totalFindings === 'number' ?
        submission.findings.totalFindings : 0
    };

    console.log('Processed findings summary:', {
      critical: findings.criticalFindings.length,
      major: findings.majorFindings.length,
      minor: findings.minorFindings.length,
      missingPlans: findings.missingPlans.length,
      missingPermits: findings.missingPermits.length,
      missingDocs: findings.missingDocumentation.length,
      missingInspections: findings.missingInspectionCertificates.length,
      total: findings.totalFindings
    });
    console.log('=== END FINDINGS DEBUG ===');

    // Generate PDF from findings data
    let browser;
    try {
      console.log('Launching browser for PDF generation...');
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 720 },
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true, // Using boolean true for compatibility
      });

      console.log('Creating new page...');
      const page = await browser.newPage();

      // Set a longer timeout for page operations
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);

      // Create HTML content for the PDF
      console.log('Generating HTML content...');
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>CivicStream Analysis Findings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          @page {
            margin: 20mm;
          }
          .header {
            margin-bottom: 30px;
            padding-bottom: 10px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
          }
          h1 {
            color: #0066cc;
            margin-top: 30px;
          }
          h2 {
            color: #333;
            margin-top: 25px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          h3 {
            color: #444;
            margin-top: 20px;
          }
          .summary {
            background-color: #f5f9ff;
            padding: 15px;
            border-left: 4px solid #0066cc;
            margin: 20px 0;
          }
          .finding {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 5px;
          }
          .critical {
            border-left: 4px solid #dc2626;
          }
          .warning {
            border-left: 4px solid #f59e0b;
          }
          .info {
            border-left: 4px solid #3b82f6;
          }
          .recommendation {
            background-color: #f0f9ff;
            padding: 10px;
            margin-top: 10px;
            border-radius: 3px;
          }
          .project-info {
            display: flex;
            flex-wrap: wrap;
            margin: 20px 0;
          }
          .project-info div {
            flex: 1;
            min-width: 200px;
            margin-bottom: 15px;
          }
          .project-info strong {
            display: block;
            font-size: 14px;
            color: #666;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <div class="logo" style="color: #0066cc; font-size: 28px; font-weight: bold;">CivicStream</div>
            <div style="text-align: right; font-size: 14px; color: #666;">
              ${new Date().toLocaleDateString()}<br>
              Report ID: ${submissionId.substring(0, 8)}
            </div>
          </div>
          <div style="border-bottom: 4px solid #0066cc; margin-bottom: 10px;"></div>
          <p style="font-size: 18px; text-align: center; margin: 10px 0;">Architectural Plan Analysis Report</p>
        </div>
        
        <h1>Analysis Findings Report</h1>
        
        <div class="project-info">
          <div>
            <strong>Project Address:</strong>
            ${submission.address}, ${submission.city}, ${submission.county}
          </div>
          <div>
            <strong>Parcel Number:</strong>
            ${submission.parcelNumber}
          </div>
          <div>
            <strong>Submission Date:</strong>
            ${new Date(submission.createdAt).toLocaleDateString()}
          </div>
          <div>
            <strong>Report Date:</strong>
            ${new Date().toLocaleDateString()}
          </div>
        </div>
        
        <div class="summary">
          <h2>Executive Summary</h2>
          <p>${findings.summary}</p>
        </div>
        
        <h2>Finding Counts</h2>
        <ul>
          <li>Critical Findings: ${findings.criticalFindings.length}</li>
          <li>Major Findings: ${findings.majorFindings.length}</li>
          <li>Minor Findings: ${findings.minorFindings.length}</li>
          <li>Missing Plans: ${findings.missingPlans.length}</li>
          <li>Missing Permits: ${findings.missingPermits.length}</li>
          <li>Missing Documentation: ${findings.missingDocumentation.length}</li>
          <li>Missing Inspections: ${findings.missingInspectionCertificates.length}</li>
          <li><strong>Total: ${findings.totalFindings} findings</strong></li>
        </ul>
        
        <h1>Detailed Findings</h1>
        
        ${findings.criticalFindings.length > 0 ? `
          <h2>Critical Findings</h2>
          ${findings.criticalFindings.map((item: any) => `
            <div class="finding critical">
              <h3>🚨 Critical Finding: ${item.description?.split(':')[0] || 'Issue'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Section:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Remedial Action:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
              ${item.confidenceScore ? `<p><strong>Confidence:</strong> ${Math.round(item.confidenceScore * 100)}%</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${findings.majorFindings.length > 0 ? `
          <h2>Major Findings</h2>
          ${findings.majorFindings.map((item: any) => `
            <div class="finding warning">
              <h3>⚠️ Major Finding: ${item.description?.split(':')[0] || 'Issue'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Section:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Remedial Action:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
              ${item.confidenceScore ? `<p><strong>Confidence:</strong> ${Math.round(item.confidenceScore * 100)}%</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${findings.minorFindings.length > 0 ? `
          <h2>Minor Findings</h2>
          ${findings.minorFindings.map((item: any) => `
            <div class="finding info">
              <h3>💡 Minor Finding: ${item.description?.split(':')[0] || 'Issue'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Section:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Remedial Action:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
              ${item.confidenceScore ? `<p><strong>Confidence:</strong> ${Math.round(item.confidenceScore * 100)}%</p>` : ''}
            </div>
          `).join('')}
        ` : ''}
        
        ${findings.missingPlans.length > 0 ? `
          <h2>Missing Plans</h2>
          ${findings.missingPlans.map((item: any) => `
            <div class="finding">
              <h3>📐 Missing Plan: ${item.description?.split(':')[0] || 'Plan'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Requirement:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Action Required:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
            </div>
          `).join('')}
        ` : ''}
        
        ${findings.missingPermits.length > 0 ? `
          <h2>Missing Permits</h2>
          ${findings.missingPermits.map((item: any) => `
            <div class="finding">
              <h3>📄 Missing Permit: ${item.description?.split(':')[0] || 'Permit'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Requirement:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Action Required:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
            </div>
          `).join('')}
        ` : ''}
        
        ${findings.missingDocumentation.length > 0 ? `
          <h2>Missing Documentation</h2>
          ${findings.missingDocumentation.map((item: any) => `
            <div class="finding">
              <h3>📋 Missing Documentation: ${item.description?.split(':')[0] || 'Documentation'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Requirement:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Action Required:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
            </div>
          `).join('')}
        ` : ''}
        
        ${findings.missingInspectionCertificates.length > 0 ? `
          <h2>Missing Inspections</h2>
          ${findings.missingInspectionCertificates.map((item: any) => `
            <div class="finding">
              <h3>✅ Missing Inspection: ${item.description?.split(':')[0] || 'Inspection'}</h3>
              <p><strong>Description:</strong> ${item.description || 'No description available'}</p>
              <p><strong>Code Requirement:</strong> ${item.codeSection || 'N/A'}</p>
              <div class="recommendation">
                <strong>Action Required:</strong> ${item.remedialAction || 'No specific action provided.'}
              </div>
            </div>
          `).join('')}
        ` : ''}
        
        <h2>Next Steps</h2>
        <ol>
          <li>Review all findings in detail above</li>
          <li>Make the necessary corrections to your plans and gather all missing documentation</li>
          <li>Resubmit your corrected plans through our system</li>
        </ol>
        
        <div class="footer">
          <p>This report was generated by CivicStream on ${new Date().toLocaleString()}</p>
          <p>© ${new Date().getFullYear()} CivicStream - All rights reserved</p>
        </div>
      </body>
      </html>
    `;

      await page.setContent(htmlContent);

      // Generate PDF
      pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      console.log(`PDF generated (${pdfBuffer.length} bytes)`);

      // Generate a filename for the report
      reportFileName = `CivicStream-Findings-${submissionId}.pdf`;
      const s3Key = `reports/${submissionId}/${reportFileName}`;
      const bucketName = process.env.S3_BUCKET_NAME || 'civicstream-reports';

      console.log(`Uploading to S3: ${s3Key}`);
      if (pdfBuffer) {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
          })
        );
      }
      console.log('Upload to S3 successful');

      // Generate a presigned URL for the S3 object
      console.log('Generating presigned URL...');
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${reportFileName}"`,
        ResponseContentType: 'application/pdf'
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
      console.log('Presigned URL generated');

      // Update the submission with the report S3 key
      console.log('Updating submission with report key...');
      await dynamoDB.send(
        new UpdateCommand({
          TableName: process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions',
          Key: { submissionId },
          UpdateExpression: 'set reportS3Key = :reportS3Key',
          ExpressionAttributeValues: {
            ':reportS3Key': s3Key,
          },
        })
      );
      console.log('Submission updated successfully');

      // Redirect to the presigned URL
      console.log('Redirecting to PDF URL');
      return NextResponse.redirect(presignedUrl);

    } catch (error: any) {
      console.error('Error in PDF generation:', error);

      // If we have the PDF but failed in later steps, try to return it directly
      if (pdfBuffer) {
        try {
          console.log('Attempting direct download fallback...');
          const headers = new Headers();
          headers.set('Content-Disposition', `attachment; filename="${reportFileName || 'findings-report.pdf'}"`);
          headers.set('Content-Type', 'application/pdf');

          return new NextResponse(pdfBuffer, {
            status: 200,
            headers,
          });
        } catch (fallbackError) {
          console.error('Fallback download failed:', fallbackError);
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to generate PDF',
          message: error.message,
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        },
        { status: 500 }
      );
    } finally {
      if (browser) {
        console.log('Closing browser...');
        try {
          await browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
    }
  } catch (outerError: any) {
    console.error('Unhandled error in report generation:', outerError);
    return NextResponse.json(
      { error: 'Failed to generate report', message: outerError.message },
      { status: 500 }
    );
  }
}
