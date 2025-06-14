import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  GetCommandInput, 
  PutCommandInput 
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
const TABLE_NAME = 'CivicStreamUserProfiles';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const params: GetCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        userId: userId
      }
    };

    const response = await docClient.send(new GetCommand(params));
    
    if (!response.Item) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(response.Item);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...profileData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    const params: PutCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        userId,
        ...profileData,
        updatedAt: timestamp,
        createdAt: timestamp
      }
    };

    await docClient.send(new PutCommand(params));

    return NextResponse.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
