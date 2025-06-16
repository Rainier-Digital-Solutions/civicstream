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

type Params = {
  id: string;
};

export async function GET(request: NextRequest) {
  try {
    // Get the submission ID from the URL params
    const pathParts = request.nextUrl.pathname.split('/');
    const submissionId = pathParts[pathParts.length - 1].split('?')[0]; // Get the last part of the URL path

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

    // Check if findings exist
    if (!submission.findings) {
      return NextResponse.json({ error: 'Findings not available yet' }, { status: 400 });
    }

    // Generate PDF from findings data
    // Use local Chrome installation on macOS
    const browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
    });

    const page = await browser.newPage();

    // Create HTML content for the PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>CivicStream Analysis Findings</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #0066cc;
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
          <div class="logo">CivicStream</div>
          <p>Architectural Plan Analysis Report</p>
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
          <p>${submission.findings.summary}</p>
        </div>
        
        <h2>Finding Counts</h2>
        <ul>
          ${submission.findings.details?.map((category: { category: string, items: any[] }) =>
      `<li>${category.category}: ${category.items.length} finding${category.items.length !== 1 ? 's' : ''}</li>`
    ).join('')}
          <li><strong>Total: ${submission.findings.details?.reduce((total: number, category: { items: any[] }) => total + category.items.length, 0) || 0} findings</strong></li>
        </ul>
        
        <h1>Detailed Findings</h1>
        
        ${submission.findings.details?.map((category: { category: string, items: any[] }) => `
          <h2>${category.category}</h2>
          ${category.items.map((item: { title: string, description: string, recommendation?: string }) => {
      let severityClass = 'info';
      let severityIcon = 'ℹ️';

      if (category.category === 'Code Compliance') {
        severityClass = 'critical';
        severityIcon = '🚨';
      } else if (category.category === 'Design Considerations') {
        severityClass = 'warning';
        severityIcon = '⚠️';
      }

      return `
              <div class="finding ${severityClass}">
                <h3>${severityIcon} ${item.title}</h3>
                <p><strong>Description:</strong> ${item.description}</p>
                ${item.recommendation ?
          `<div class="recommendation">
                    <strong>Remedial Action:</strong> ${item.recommendation}
                  </div>` : ''
        }
              </div>
            `;
    }).join('')}
        `).join('')}
        
        <div class="footer">
          <p>This report was generated by CivicStream on ${new Date().toLocaleString()}</p>
          <p>© ${new Date().getFullYear()} CivicStream - All rights reserved</p>
        </div>
      </body>
      </html>
    `;

    await page.setContent(htmlContent);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    // Generate a filename for the report
    const reportFileName = `CivicStream-Findings-${submissionId}.pdf`;
    const s3Key = `reports/${submissionId}/${reportFileName}`;
    const bucketName = process.env.S3_BUCKET_NAME || 'civicstream-plan-storage-c692c0ba';

    try {
      // Check if the report already exists in S3
      let reportExists = false;
      try {
        await s3.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: s3Key
        }));
        reportExists = true;
      } catch (error) {
        // Object doesn't exist, we'll upload it
        reportExists = false;
      }

      // If report doesn't exist in S3, upload it
      if (!reportExists) {
        await s3.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          Metadata: {
            submissionId: submissionId,
            reportType: 'findings'
          }
        }));

        console.log(`Uploaded findings report to S3: ${s3Key}`);

        // Update the submission record with the report S3 key
        await dynamoDB.send(new UpdateCommand({
          TableName: process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions',
          Key: { submissionId },
          UpdateExpression: 'set reportS3Key = :reportS3Key',
          ExpressionAttributeValues: {
            ':reportS3Key': s3Key
          }
        }));
      }

      // Generate a presigned URL for the report with a 15-minute expiration
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${reportFileName}"`,
        ResponseContentType: 'application/pdf'
      });
      
      const presignedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 900 }); // 15 minutes in seconds

      // Redirect the user to the presigned URL for direct download
      return NextResponse.redirect(presignedUrl);
    } catch (s3Error) {
      console.error('Error handling S3 operations:', s3Error);

      // If S3 operations fail, fall back to direct download
      const headers = new Headers();
      headers.set('Content-Disposition', `attachment; filename="${reportFileName}"`);
      headers.set('Content-Type', 'application/pdf');

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    console.error('Error generating findings report:', error);
    return NextResponse.json({ error: 'Failed to generate findings report' }, { status: 500 });
  }
}
