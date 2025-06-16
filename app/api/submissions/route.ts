import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommandInput,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput
} from '@aws-sdk/lib-dynamodb';

// Initialize the DynamoDB client
const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'CivicStreamSubmissions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const submissionId = searchParams.get('submissionId');

    // If submissionId is provided, get a specific submission
    if (submissionId) {
      const params: GetCommandInput = {
        TableName: TABLE_NAME,
        Key: {
          submissionId: submissionId
        }
      };

      const response = await docClient.send(new GetCommand(params));
      
      if (!response.Item) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }

      return NextResponse.json(response.Item);
    }
    
    // Otherwise, get all submissions for a user
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const params: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: 'UserSubmissionsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // Sort by createdAt in descending order (newest first)
    };

    const response = await docClient.send(new QueryCommand(params));
    
    return NextResponse.json(response.Items || []);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      submissionId, 
      userId, 
      fileName, 
      fileSize, 
      address, 
      parcelNumber, 
      city, 
      county, 
      status, 
      createdAt, 
      updatedAt 
    } = body;

    if (!submissionId || !userId) {
      return NextResponse.json({ error: 'Submission ID and User ID are required' }, { status: 400 });
    }

    const params: PutCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        submissionId,
        userId,
        fileName: fileName || 'Unknown',
        fileSize: fileSize || 0,
        address: address || '',
        parcelNumber: parcelNumber || '',
        city: city || '',
        county: county || '',
        status: status || 'Processing',
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString()
      }
    };

    await docClient.send(new PutCommand(params));

    return NextResponse.json({ success: true, message: 'Submission created successfully' });
  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, status, findings } = body;

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 });
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Get the current submission to ensure it exists
    const getParams: GetCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        submissionId: submissionId
      }
    };

    const getResponse = await docClient.send(new GetCommand(getParams));
    
    if (!getResponse.Item) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Prepare update expression and attribute values
    let updateExpression = 'SET #status = :status, updatedAt = :updatedAt';
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status'
    };
    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
      ':updatedAt': new Date().toISOString()
    };

    // Add findings to update if provided
    if (findings) {
      updateExpression += ', findings = :findings';
      expressionAttributeValues[':findings'] = findings;
    }

    // Update the submission
    const updateParams: UpdateCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        submissionId: submissionId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };

    const updateResponse = await docClient.send(new UpdateCommand(updateParams));

    return NextResponse.json({
      success: true,
      message: 'Submission updated successfully',
      submission: updateResponse.Attributes
    });
  } catch (error) {
    console.error('Error updating submission status:', error);
    return NextResponse.json({ error: 'Failed to update submission status' }, { status: 500 });
  }
}
