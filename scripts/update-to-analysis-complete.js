#!/usr/bin/env node

/**
 * Script to update a specific submission to "Analysis Complete" status
 * This will trigger a DynamoDB Stream event which should be processed by our Lambda function
 * and sent to connected WebSocket clients
 */

const fetch = require('node-fetch');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const submissionId = process.argv[2]; // Get submission ID from command line argument

if (!submissionId) {
  console.error('Error: No submission ID provided');
  console.error('Usage: node update-to-analysis-complete.js <submissionId>');
  process.exit(1);
}

async function updateSubmissionStatus() {
  try {
    console.log(`Updating submission ${submissionId} to status: Analysis Complete`);
    
    const response = await fetch(`${API_URL}/submissions`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        submissionId,
        status: 'Analysis Complete',
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

updateSubmissionStatus()
  .then(() => {
    console.log('Done! The WebSocket should now receive this update.');
    console.log('To test, open the submission detail page for this submission ID.');
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
