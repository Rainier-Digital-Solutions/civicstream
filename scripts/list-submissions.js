#!/usr/bin/env node

/**
 * Script to list all submissions in the DynamoDB table
 * 
 * Usage:
 * node list-submissions.js
 */

const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS
const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });

// Create DynamoDB client
const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function listSubmissions() {
  try {
    console.log('Fetching submissions from DynamoDB...');
    
    const params = {
      TableName: process.env.SUBMISSIONS_TABLE || 'CivicStreamSubmissions'
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      console.log(`Found ${result.Items.length} submissions:`);
      
      result.Items.forEach((submission, index) => {
        console.log(`\n--- Submission ${index + 1} ---`);
        console.log(`ID: ${submission.submissionId}`);
        console.log(`Status: ${submission.status}`);
        console.log(`Address: ${submission.address}`);
        console.log(`Created: ${new Date(submission.createdAt).toLocaleString()}`);
        console.log(`Updated: ${new Date(submission.updatedAt).toLocaleString()}`);
        
        if (submission.findings) {
          console.log('Findings: Yes');
        } else {
          console.log('Findings: No');
        }
      });
    } else {
      console.log('No submissions found in the database.');
    }
    
  } catch (error) {
    console.error('Error listing submissions:', error);
    process.exit(1);
  }
}

// Run the script
listSubmissions();
