# CivicStream Dashboard Feature

This document provides an overview of the user dashboard feature for tracking architectural plan submissions in the CivicStream application.

## Features Implemented

1. **Dashboard Page** (`/dashboard`)
   - Shows submission statistics (total, processing, completed, emailed)
   - Displays a filterable table of all user submissions with status badges
   - Allows navigation to detailed submission views
   - Protected by authentication (redirects to login if not authenticated)
   - Auto-refreshes every 30 seconds to show updated statuses

2. **Submission Detail Page** (`/dashboard/submission/[id]`)
   - Shows comprehensive information about a specific submission
   - Displays current status with visual timeline
   - Shows project information (address, parcel number, city, county)
   - Shows file information with download options
   - Protected by authentication

3. **API Endpoints** (`/api/submissions`)
   - `GET` - Fetch submissions by userId or a specific submission by submissionId
   - `POST` - Create a new submission record
   - `PATCH` - Update the status of a submission

4. **Utilities**
   - `update-submission-status.js` script for updating submission status via CLI
   - `update-submission.js` utility for updating submission status from Lambda functions

## How Status Updates Work

1. When a user submits a plan, it's initially saved with a status of "Processing"
2. The dashboard polls for updates every 30 seconds to reflect any status changes
3. Backend processes can update the status using either:
   - The API endpoint: `PATCH /api/submissions` with `submissionId` and `status`
   - The CLI script: `node scripts/update-submission-status.js <submissionId> <status>`
   - The utility function: `updateSubmissionStatus(apiUrl, submissionId, status)`

## Status Flow

Submissions follow this status progression:
1. **Processing** - Initial state when a plan is submitted
2. **Analysis Complete** - When the AI analysis has finished
3. **Findings Report Emailed** - When the report has been sent to the user

## Required Environment Variables

For production deployment, ensure these environment variables are set:

1. AWS Cognito variables:
   - `NEXT_PUBLIC_COGNITO_REGION`
   - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - `NEXT_PUBLIC_COGNITO_CLIENT_ID`

2. AWS credentials for DynamoDB access:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`

## AWS Resources

The feature relies on:
- DynamoDB table `CivicStreamSubmissions` with:
  - Primary key on `submissionId`
  - Global secondary index `UserSubmissionsIndex` on `userId` + `createdAt`
- AWS Cognito for authentication

## Integration with Processing Pipeline

To integrate with the existing processing pipeline:
1. After analysis is complete, update the submission status to "Analysis Complete"
2. After sending the findings report email, update the status to "Findings Report Emailed"

Example Lambda code:
```javascript
const { updateSubmissionStatus } = require('./utils/update-submission');

// In your Lambda function after analysis completes
await updateSubmissionStatus(
  'https://your-api-domain.com',
  submissionId,
  'Analysis Complete'
);

// After sending the email
await updateSubmissionStatus(
  'https://your-api-domain.com',
  submissionId,
  'Findings Report Emailed'
);
```
