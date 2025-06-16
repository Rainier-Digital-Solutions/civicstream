import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

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
    
    // Check if we have the S3 key stored in the submission
    if (!submission.s3Key) {
      return NextResponse.json({ 
        error: 'S3 key not found in submission. This file may no longer be available for download.',
        message: 'The original plan file has expired. Due to storage limitations, plan files are only stored for 24 hours.',
        code: 'FILE_EXPIRED'
      }, { status: 404 });
    }
    
    try {
      // Generate a presigned URL for the S3 object
      const bucketName = process.env.S3_BUCKET_NAME || 'civicstream-plan-storage-c692c0ba';
      const s3Key = submission.s3Key;
      
      // First check if the object still exists in S3
      try {
        await s3.send(new HeadObjectCommand({
          Bucket: bucketName,
          Key: s3Key
        }));
      } catch (error) {
        // If the object doesn't exist, return a friendly error
        return NextResponse.json({ 
          error: 'File not found in storage',
          message: 'The original plan file has expired. Due to storage limitations, plan files are only stored for 24 hours.',
          code: 'FILE_EXPIRED'
        }, { status: 404 });
      }
      
      // Generate a presigned URL with a 15-minute expiration
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${submission.fileName}"`,
        ResponseContentType: 'application/pdf'
      });
      
      const presignedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 900 }); // 15 minutes in seconds
      
      // Redirect the user to the presigned URL for direct download
      return NextResponse.redirect(presignedUrl);
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      return NextResponse.json({ 
        error: 'Failed to generate download URL',
        message: 'There was an error generating the download URL. Please try again later.',
        code: 'PRESIGNED_URL_ERROR'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error downloading plan:', error);
    return NextResponse.json({ error: 'Failed to download plan' }, { status: 500 });
  }
}
