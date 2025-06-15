#!/usr/bin/env node

/**
 * Script to get the URL for a specific submission detail page
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient);

async function getRecentSubmission() {
  try {
    const scanCommand = new ScanCommand({
      TableName: 'CivicStreamSubmissions',
      Limit: 10
    });
    
    const result = await ddbDocClient.send(scanCommand);
    
    if (result.Items && result.Items.length > 0) {
      // Sort by updatedAt in descending order to get the most recently updated submission
      const sortedSubmissions = result.Items.sort((a, b) => {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
      
      return sortedSubmissions[0];
    } else {
      console.error('No submissions found in the database');
      return null;
    }
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return null;
  }
}

async function main() {
  const submission = await getRecentSubmission();
  
  if (submission) {
    const submissionId = submission.submissionId;
    const status = submission.status;
    
    console.log(`Most recently updated submission: ${submissionId}`);
    console.log(`Current status: ${status}`);
    console.log(`\nURL: http://localhost:3000/dashboard/submission/${submissionId}`);
    console.log('\nTo test WebSocket updates:');
    console.log('1. Open the URL above in your browser');
    console.log('2. Run: node scripts/update-to-analysis-complete.js ' + submissionId);
    console.log('3. Observe the submission status update in real-time without page refresh');
  } else {
    console.error('Failed to get a submission');
    process.exit(1);
  }
}

main();
