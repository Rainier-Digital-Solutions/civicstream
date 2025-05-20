# Responses API Reference

This document provides detailed API documentation for the CivicStream architectural plan review system using OpenAI's Responses API.

## Table of Contents

1. [Endpoints](#endpoints)
2. [Request/Response Formats](#requestresponse-formats)
3. [Rate Limits](#rate-limits)
4. [Environment Variables](#environment-variables)

## Endpoints

### POST /api/plan-review-responses

Main endpoint for processing architectural plans.

#### Request Format

1. **Direct File Upload (multipart/form-data)**
   ```typescript
   Content-Type: multipart/form-data
   
   file: File                    // PDF file (required)
   submitterEmail: string        // Email of plan submitter (required)
   cityPlannerEmail: string      // Email of city planner (required)
   address: string              // Project address (required)
   parcelNumber: string         // Parcel number (required)
   city: string                 // City name (required)
   county: string               // County name (required)
   projectSummary?: string      // Optional project description
   ```

2. **Blob URL Upload (application/json)**
   ```typescript
   Content-Type: application/json
   
   {
     blobUrl: string            // URL of uploaded PDF (required)
     submitterEmail: string     // Email of plan submitter (required)
     cityPlannerEmail: string   // Email of city planner (required)
     address: string           // Project address (required)
     parcelNumber: string      // Parcel number (required)
     city: string              // City name (required)
     county: string            // County name (required)
     projectSummary?: string   // Optional project description
   }
   ```

#### Response Format

```typescript
{
  success: boolean              // Whether the request was successful
  isCompliant: boolean         // Whether the plan is code compliant
  totalFindings: number        // Total number of findings
  error?: string              // Error message if request failed
}
```

#### Error Responses

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Missing required fields or invalid input |
| 413 | Payload Too Large - File exceeds size limit |
| 415 | Unsupported Media Type - Non-PDF file |
| 500 | Internal Server Error - Processing failed |

### GET /api/test-responses-api

Test endpoint for verifying the Responses API implementation.

#### Response Format

```typescript
{
  success: boolean,
  testResult: {
    isCompliant: boolean,
    totalFindings: number,
    summary: string,
    criticalFindings: Array<Finding>,
    majorFindings: Array<Finding>,
    minorFindings: Array<Finding>
  },
  message: string,
  error?: string
}
```

## Request/Response Formats

### Finding Object

```typescript
interface Finding {
  id: string;           // Unique identifier
  type: 'critical' | 'major' | 'minor';
  description: string;  // Detailed description
  codeReference: string; // Building code reference
  recommendation: string; // How to fix the issue
  location?: string;    // Where in the plans the issue was found
}
```

### Email Templates

1. **City Planner Email**
   ```typescript
   interface CityPlannerEmail {
     subject: string;
     body: string;  // HTML formatted
     attachments: Array<{
       filename: string;
       content: string;  // Base64 encoded
     }>;
   }
   ```

2. **Submitter Email**
   ```typescript
   interface SubmitterEmail {
     subject: string;
     body: string;  // HTML formatted
     attachments: Array<{
       filename: string;
       content: string;  // Base64 encoded
     }>;
   }
   ```

## Rate Limits

### API Limits
- Maximum file size: 100MB
- Maximum concurrent requests: 10 per minute
- Request timeout: 5 minutes

### OpenAI API Limits
- File upload size: 512MB
- Vector store size: 1GB
- Rate limit: 3 requests per minute

### Resource Cleanup
- Temporary files: Deleted after 5 minutes
- Vector stores: Deleted after successful processing
- Uploaded files: Deleted after successful processing

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Yes | - |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL for API endpoints | No | http://localhost:3000 |

## Error Handling

### Common Error Codes

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `INVALID_FILE` | File is not a valid PDF | Ensure file is a valid PDF |
| `FILE_TOO_LARGE` | File exceeds size limit | Reduce file size or split into multiple files |
| `API_ERROR` | OpenAI API error | Check API key and rate limits |
| `PROCESSING_ERROR` | Error during processing | Check logs for details |

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;        // Error message
  code: string;         // Error code
  details?: string;     // Additional details
  timestamp: string;    // When the error occurred
}
```

## Related Documentation
- [Implementation Guide](responses-api-implementation.md)
- [Testing Guide](responses-api-testing.md)
- [Migration Guide](responses-api-migration.md) 