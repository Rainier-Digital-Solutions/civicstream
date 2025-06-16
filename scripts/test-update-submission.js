#!/usr/bin/env node

/**
 * Script to test updating a submission status via the API
 * This will trigger a DynamoDB Stream event which should be processed by our Lambda function
 * and sent to connected WebSocket clients
 */

const fetch = require('node-fetch');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const submissionId = process.argv[2];
const newStatus = process.argv[3] || 'Findings Report Emailed';

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient);

async function getRandomSubmission() {
  try {
    const scanCommand = new ScanCommand({
      TableName: 'CivicStreamSubmissions',
      Limit: 10
    });
    
    const result = await ddbDocClient.send(scanCommand);
    
    if (result.Items && result.Items.length > 0) {
      // Return a random submission
      const randomIndex = Math.floor(Math.random() * result.Items.length);
      return result.Items[randomIndex];
    } else {
      console.error('No submissions found in the database');
      return null;
    }
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return null;
  }
}

async function updateSubmissionStatus(submissionId, status) {
  try {
    const response = await fetch(`${API_URL}/submissions`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        submissionId,
        status,
        findings: {
          summary: "The submitted architectural plan generally complies with local building codes but has several areas that need attention before approval.",
          details: [
            {
              category: "Code Compliance",
              items: [
                {
                  title: "Egress Requirements",
                  description: "The secondary bedroom does not meet minimum egress window requirements of 5.7 square feet.",
                  recommendation: "Increase the size of the window to at least 5.7 square feet with minimum dimensions of 24\" height and 20\" width."
                },
                {
                  title: "Stair Dimensions",
                  description: "The staircase rise/run dimensions do not meet code requirements. Current rise is 8.5\" (max allowed is 7.75\").",
                  recommendation: "Adjust stair dimensions to have maximum rise of 7.75\" and minimum run of 10\"."
                }
              ]
            },
            {
              category: "Energy Efficiency",
              items: [
                {
                  title: "Insulation Values",
                  description: "The proposed wall insulation R-value of R-13 is below the required R-21 for climate zone 5.",
                  recommendation: "Upgrade wall insulation to minimum R-21 or consider alternative wall assembly that meets equivalent performance."
                }
              ]
            }
          ]
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Submission updated successfully:', data);
      return data;
    } else {
      const errorText = await response.text();
      console.error(`Error updating submission: ${response.status} ${response.statusText}`);
      console.error('Error details:', errorText);
      return null;
    }
  } catch (error) {
    console.error('Error updating submission:', error);
    return null;
  }
}

async function main() {
  let targetSubmissionId = submissionId;
  
  if (!targetSubmissionId) {
    console.log('No submission ID provided, fetching a random submission...');
    const submission = await getRandomSubmission();
    if (submission) {
      targetSubmissionId = submission.submissionId;
      console.log(`Selected random submission: ${targetSubmissionId}`);
    } else {
      console.error('Failed to get a random submission');
      process.exit(1);
    }
  }
  
  console.log(`Updating submission ${targetSubmissionId} to status: ${newStatus}`);
  const result = await updateSubmissionStatus(targetSubmissionId, newStatus);
  
  if (result) {
    console.log('Success! The WebSocket should now receive this update.');
    console.log('To test, open the submission detail page for this submission ID.');
  } else {
    console.error('Failed to update submission status');
    process.exit(1);
  }
}

main();
