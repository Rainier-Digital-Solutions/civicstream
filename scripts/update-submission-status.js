#!/usr/bin/env node

/**
 * Script to update the status of a submission in the CivicStreamSubmissions table
 * 
 * Usage:
 * node update-submission-status.js <submissionId> <status>
 * 
 * Example:
 * node update-submission-status.js abc123 "Analysis Complete"
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize the DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-west-2'
});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = 'CivicStreamSubmissions';

async function updateSubmissionStatus(submissionId, status) {
  if (!submissionId || !status) {
    console.error('Error: Both submissionId and status are required');
    process.exit(1);
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        submissionId: submissionId
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const response = await docClient.send(new UpdateCommand(params));
    console.log(`Successfully updated submission ${submissionId} status to "${status}"`);
    console.log('Updated submission:', response.Attributes);
    return response.Attributes;
  } catch (error) {
    console.error('Error updating submission status:', error);
    process.exit(1);
  }
}

// Get command line arguments
const submissionId = process.argv[2];
const status = process.argv[3];

// Validate status
const validStatuses = ['Processing', 'Analysis Complete', 'Findings Report Emailed'];
if (!validStatuses.includes(status)) {
  console.error(`Error: Status must be one of: ${validStatuses.join(', ')}`);
  process.exit(1);
}

// Run the update
updateSubmissionStatus(submissionId, status)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
