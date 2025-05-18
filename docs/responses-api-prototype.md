# OpenAI Responses API Prototype for CivicStream

This document describes the prototype implementation of CivicStream's architectural plan review system using OpenAI's new Responses API. The prototype maintains feature parity with the existing solution while leveraging the new API's capabilities for file handling and web search.

## Overview

The prototype implements a parallel architecture that can be tested alongside the existing system. It demonstrates how the Responses API can simplify our codebase by natively handling:

1. **PDF file uploads** directly to OpenAI
2. **Web search capabilities** without requiring a SERPAPI integration
3. **Conversation state management** within a single API call

## Implementation Details

### New Files Added

| File | Description |
|------|-------------|
| `/app/api/plan-review-responses/route.ts` | Main API route for the Responses API implementation |
| `/app/api/test-responses-api/route.ts` | Test route to verify the Responses API implementation |
| `lib/openai.ts` (extended) | Added `reviewPlanWithResponsesAPI` function |

### Modifications to Existing Files

| File | Changes |
|------|---------|
| `/app/api/send-email/route.ts` | Added support for direct base64 file data in addition to blob URLs |

## How It Works

The prototype follows the same workflow as the original implementation:

1. **Upload** - User uploads a PDF of architectural plans (handled either through direct upload or blob URL)
2. **Process** - The plan is sent to OpenAI using the Responses API:
   - PDF is uploaded to OpenAI directly
   - OpenAI processes the PDF and performs web search for building codes
   - A structured review is generated in the same format as the original implementation
3. **Delivery** - Results are sent via email using the existing email service

### Key Differences from Original Implementation

| Feature | Original Implementation | Responses API Implementation |
|---------|------------------------|------------------------------|
| Web Search | Uses SERPAPI integration | Native web search through OpenAI |
| PDF Processing | Manual chunking for large PDFs | Native PDF handling by OpenAI |
| API Structure | Multiple API calls with tool orchestration | Single API call with file attachment |
| Code Complexity | More complex error handling and state management | Simplified workflow with less code |

## Testing the Prototype

### Test Endpoint

A test endpoint is available at `/api/test-responses-api` that will:
1. Load a sample PDF (or create a minimal test PDF if none is found)
2. Submit it to the Responses API route
3. Return the results for verification

### Manual Testing

You can also test the prototype manually by:

1. Using your existing upload mechanism to get a blob URL
2. Sending a POST request to `/api/plan-review-responses` with the same parameters as your existing endpoint
3. Comparing the results with the original implementation

### Sample Test Request

```typescript
// Direct file upload method
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('submitterEmail', 'submitter@example.com');
formData.append('cityPlannerEmail', 'planner@example.com');
formData.append('address', '123 Main St');
formData.append('parcelNumber', '123456-7890');
formData.append('city', 'Seattle');
formData.append('county', 'King County');

const response = await fetch('/api/plan-review-responses', {
  method: 'POST',
  body: formData
});

// Or using a blob URL from your existing upload mechanism
const response = await fetch('/api/plan-review-responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    blobUrl: 'https://your-blob-url.com/file.pdf',
    submitterEmail: 'submitter@example.com',
    cityPlannerEmail: 'planner@example.com',
    address: '123 Main St',
    parcelNumber: '123456-7890',
    city: 'Seattle',
    county: 'King County'
  })
});
```

## Performance Comparison

When comparing the two implementations, evaluate:

1. **Response time** - Is the Responses API faster or slower?
2. **Result quality** - Are the findings and recommendations equivalent?
3. **Robustness** - Does it handle large PDFs and edge cases as well?
4. **Cost** - Are there significant cost differences?

## Migration Path

If the Responses API prototype meets our needs, a gradual migration plan could include:

1. Run both implementations in parallel for a testing period
2. Add Responses API as a configurable option via environment variable
3. Monitor performance and results
4. Switch over fully once confidence is high

## Known Limitations

1. The Responses API is still in beta, and its behavior may change
2. There's less granular control over the web search behavior compared to our custom SERPAPI integration
3. File size limitations may differ from our current chunking approach
4. The response format might require additional validation

## Next Steps

1. Perform thorough testing with real architectural plans
2. Analyze performance, cost, and quality metrics
3. Identify any gaps in functionality
4. Make a decision on whether to fully migrate to the Responses API 