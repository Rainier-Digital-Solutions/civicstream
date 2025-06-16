#!/usr/bin/env node

/**
 * Script to toggle a submission between "Analysis Complete" and "Findings Report Emailed" statuses
 * This demonstrates the real-time WebSocket updates in action
 */

const fetch = require('node-fetch');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const submissionId = process.argv[2];

if (!submissionId) {
  console.error('Error: No submission ID provided');
  console.error('Usage: node toggle-submission-status.js <submissionId>');
  process.exit(1);
}

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient);

async function getCurrentStatus() {
  try {
    const getCommand = new GetCommand({
      TableName: 'CivicStreamSubmissions',
      Key: { submissionId }
    });
    
    const result = await ddbDocClient.send(getCommand);
    
    if (result.Item) {
      return result.Item.status;
    } else {
      console.error(`Submission ${submissionId} not found`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error fetching submission:', error);
    process.exit(1);
  }
}

async function updateSubmissionStatus(status) {
  try {
    console.log(`Updating submission ${submissionId} to status: ${status}`);
    
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
  const currentStatus = await getCurrentStatus();
  console.log(`Current status: ${currentStatus}`);
  
  // Toggle the status
  const newStatus = currentStatus === 'Analysis Complete' ? 'Findings Report Emailed' : 'Analysis Complete';
  
  const result = await updateSubmissionStatus(newStatus);
  
  if (result) {
    console.log(`Successfully toggled status from ${currentStatus} to ${newStatus}`);
    console.log('The WebSocket should now receive this update.');
    console.log(`To test again, run this script again with the same submission ID: node toggle-submission-status.js ${submissionId}`);
  } else {
    console.error('Failed to update submission status');
    process.exit(1);
  }
}

main();
