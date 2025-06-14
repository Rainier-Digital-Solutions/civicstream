#!/usr/bin/env node

/**
 * Script to update an existing submission with "Findings Report Emailed" status and findings data
 * 
 * Usage:
 * node update-test-submission.js <submissionId>
 */

// Import the fetch API for Node.js
const fetch = require('node-fetch');
require('dotenv').config();

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
    console.error('Usage: node update-test-submission.js <submissionId>');
    process.exit(1);
  }

  try {
    // Use localhost for testing
    const apiUrl = 'http://localhost:3000/api/submissions';
    const status = 'Findings Report Emailed';
    
    console.log(`Updating submission ${submissionId} to status "${status}" with findings data...`);
    
    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submissionId,
        status,
        findings: sampleFindings
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('Update successful!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    console.log(`\nYou can now view the updated submission at: http://localhost:3000/dashboard/submission/${submissionId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating submission:', error.message);
    process.exit(1);
  }
}

// Run the update
updateSubmission();
