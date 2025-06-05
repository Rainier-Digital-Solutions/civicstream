# Claude AI Plan Review Implementation

This document outlines the current implementation of CivicStream's architectural plan review system using Anthropic's Claude AI on AWS infrastructure.

## Overview

The system implements a comprehensive plan review approach that includes:
1. Application type identification
2. Missing document analysis by category
3. Enhanced JSON schema with missing items
4. Professional HTML email formatting with application cover pages
5. Building code research via Perplexity API
6. Background processing via AWS SQS and Lambda

## Key Changes Made

### 1. Updated TypeScript Interfaces

**New Interface: `MissingItem`**
```typescript
export interface MissingItem {
  description: string;
  codeSection: string;
  remedialAction: string;
  confidenceScore: number;
  severity: "critical" | "major" | "minor";
}
```

**Updated Interface: `ReviewResult`**
Added new fields:
- `missingPlans: MissingItem[]`
- `missingPermits: MissingItem[]`
- `missingDocumentation: MissingItem[]`
- `missingInspectionCertificates: MissingItem[]`

### 2. Current Implementation

**AWS Lambda Processing**
- Runs in `plan-processor` Lambda function
- Uses Anthropic Claude Sonnet 4 model
- Processes PDFs with pdf-parse library
- Integrates Perplexity API for building code research
- Sends HTML emails via Nodemailer

**COMPLIANCE_REVIEW_PROMPT (in aws-lambda-fix-index.js)**
- Scope: Washington state building codes and regulations
- Application type identification (FIRST step)
- Comprehensive missing document analysis (SECOND step)
- Specific requirements for single-family residence applications:
  - Required PLANS (11 items)
  - Required PERMITS AND APPLICATIONS (9 items)
  - Required ADDITIONAL DOCUMENTATION (9 items)
  - Required INSPECTION CERTIFICATES (6 items)
- JSON schema includes missing items categories
- Professional HTML email templates with application cover page

### 3. Current AWS Lambda Functions

**Main Processing Function:**
- `reviewPlanWithClaude()` - Core Claude AI integration
- `performWebSearch()` - Perplexity API integration for building codes
- `sendEmail()` - HTML email delivery via Nodemailer
- `getDefaultErrorResponse()` - Fallback response on processing failures

**Enhanced Features:**
- PDF text extraction with fallback handling
- Retry logic (up to 3 attempts) for Claude API calls
- Automatic S3 cleanup after processing
- Comprehensive error logging
- Professional HTML email templates

### 4. Email Template Enhancements

**New sections added to email templates:**
- Application Cover Page with project details
- Missing Items section organized by category
- Enhanced Finding Counts including missing items counts

**Email structure now includes:**
1. Header (blue for compliant, red for action required)
2. Application Cover Page (NEW)
3. Introductory paragraph
4. Review Summary section
5. Finding Counts box (enhanced with missing items)
6. Detailed Findings section
7. Missing Items section (NEW)
8. Next Steps (for submitter only)
9. Footer

## Current AWS Processing Workflow

The review process follows this sequence:

1. **Upload**: Frontend gets S3 presigned URL from upload-handler Lambda
2. **Storage**: File uploaded directly to S3 bucket
3. **Trigger**: Upload completion sends message to SQS queue
4. **Processing**: plan-processor Lambda picks up SQS message
5. **Analysis**: 
   - Download PDF from S3
   - Extract text using pdf-parse
   - Search building codes via Perplexity API
   - Analyze with Claude AI
6. **Delivery**: Send HTML emails to submitter and city planner
7. **Cleanup**: Remove file from S3 bucket

## Required Documents for Single-Family Residence

### Plans (11 required)
- Site plan with boundaries, setbacks, structure placement
- Architectural plans (floor plans, elevations, sections)
- Structural plans and calculations
- Foundation plans
- Framing plans
- Roof plans
- MEP plans
- Energy code compliance documentation
- Stormwater management plan
- Erosion and sediment control plan
- Landscape plan (if required by jurisdiction)

### Permits & Applications (9 required)
- Building permit application
- Plumbing permit
- Electrical permit
- Mechanical permit
- Water/sewer connection permits
- Right-of-way use permit (if applicable)
- Tree removal permit (if applicable)
- Grading permit (for significant earth movement)
- Stormwater drainage permit

### Additional Documentation (9 required)
- SEPA checklist (if applicable)
- Water availability certification
- Septic approval (for areas without sewer service)
- Critical areas assessment
- Geotechnical report (for challenging conditions)
- Title report/property survey
- HOA approval (if applicable)
- Proof of contractor registration
- Contractor's liability insurance documentation

### Inspection Certificates (6 required)
- Pre-construction
- Foundation/footings
- Framing
- Electrical/plumbing/mechanical rough-in
- Insulation
- Final inspection

## Infrastructure Benefits

1. **Scalability**: AWS Lambda auto-scales based on demand
2. **Cost Efficiency**: Pay-per-request pricing model
3. **Reliability**: Built-in retry mechanisms and dead letter queues
4. **Security**: S3 presigned URLs for secure file uploads
5. **Performance**: Background processing doesn't block user interface
6. **Monitoring**: CloudWatch logs for debugging and monitoring

## Current Features

1. **AI-Powered Analysis**: Claude Sonnet 4 for comprehensive plan review
2. **Building Code Research**: Perplexity API for real-time code lookup
3. **Professional Communication**: HTML email templates with styling
4. **Large File Support**: Handles PDFs up to 50MB
5. **Washington State Focus**: Specialized for WA building codes
6. **Automatic Cleanup**: S3 lifecycle policies for cost optimization

## Monitoring and Debugging

- **CloudWatch Logs**: All Lambda functions log to CloudWatch
- **Error Handling**: Comprehensive error logging and fallback responses
- **Dead Letter Queue**: Failed messages routed to DLQ for investigation
- **S3 Lifecycle**: Automatic cleanup after 24 hours
