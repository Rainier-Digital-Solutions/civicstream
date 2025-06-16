#!/usr/bin/env node

/**
 * Script to directly update a submission in DynamoDB with findings data
 * 
 * Usage:
 * node direct-update-submission.js <submissionId>
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

// Configure AWS
const region = process.env.AWS_REGION || 'us-west-2';
const client = new DynamoDBClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});
const docClient = DynamoDBDocumentClient.from(client);

// Sample findings data
const sampleFindings = {
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
    },
    {
      category: "Accessibility",
      items: [
        {
          title: "Bathroom Clearances",
          description: "The ground floor bathroom does not provide adequate clearance for accessibility. Current clearance is 28\" in front of fixtures (36\" required).",
          recommendation: "Reconfigure bathroom layout to provide minimum 36\" clearance in front of all fixtures."
        }
      ]
    }
  ]
};

async function updateSubmission() {
  // Get command line arguments
  const submissionId = process.argv[2];

  if (!submissionId) {
    console.error('Error: Submission ID is required');
    console.error('Usage: node direct-update-submission.js <submissionId>');
    process.exit(1);
  }

  try {
    // First, check if the submission exists
    console.log(`Checking if submission ${submissionId} exists...`);
    
    const tableName = process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions';
    
    const getParams = {
      TableName: tableName,
      Key: {
        submissionId: submissionId
      }
    };
    
    const getResult = await docClient.send(new GetCommand(getParams));
    
    if (!getResult.Item) {
      console.error(`Submission with ID ${submissionId} not found.`);
      process.exit(1);
    }
    
    console.log('Submission found. Current status:', getResult.Item.status);
    
    // Update the submission with findings data and set status to "Findings Report Emailed"
    console.log('Updating submission with findings data...');
    
    const updateParams = {
      TableName: tableName,
      Key: {
        submissionId: submissionId
      },
      UpdateExpression: 'SET #status = :status, findings = :findings, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'Findings Report Emailed',
        ':findings': sampleFindings,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await docClient.send(new UpdateCommand(updateParams));
    
    console.log('Update successful!');
    console.log('New status:', updateResult.Attributes.status);
    console.log('Findings data added:', !!updateResult.Attributes.findings);
    
    console.log(`\nYou can now view the updated submission at: http://localhost:3000/dashboard/submission/${submissionId}`);
    
  } catch (error) {
    console.error('Error updating submission:', error);
    process.exit(1);
  }
}

// Run the update
updateSubmission();
