#!/usr/bin/env node

/**
 * Script to create a test submission in the DynamoDB table
 * 
 * Usage:
 * node create-test-submission.js
 */

const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

// Configure AWS
const region = process.env.AWS_REGION || 'us-east-1';
const client = new DynamoDB({ region });
const dynamoDB = DynamoDBDocument.from(client);

async function createTestSubmission() {
  try {
    console.log('Creating test submission in DynamoDB...');
    
    const timestamp = Date.now();
    const submissionId = `test-submission-${timestamp}`;
    
    const submission = {
      submissionId,
      userId: 'test-user-123',
      fileName: 'test-architectural-plan.pdf',
      fileSize: 2500000, // 2.5MB
      address: '123 Main Street',
      parcelNumber: 'APN-12345-6789',
      city: 'San Francisco',
      county: 'San Francisco',
      status: 'Processing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectSummary: 'This is a test project for a two-story residential addition with new kitchen and bathroom.'
    };
    
    const params = {
      TableName: process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions',
      Item: submission
    };
    
    await dynamoDB.put(params);
    
    console.log('Test submission created successfully!');
    console.log('Submission ID:', submissionId);
    console.log('Status:', submission.status);
    console.log('\nYou can now update this submission using:');
    console.log(`node scripts/test-update-with-findings.js ${submissionId}`);
    
  } catch (error) {
    console.error('Error creating test submission:', error);
    process.exit(1);
  }
}

// Run the script
createTestSubmission();
