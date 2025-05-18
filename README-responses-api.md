# OpenAI Responses API Prototype for CivicStream

## Overview

This prototype demonstrates how to use OpenAI's Responses API for the CivicStream architectural plan review system. It provides the same functionality as our current implementation but leverages OpenAI's newer API that natively handles:

1. **File uploads** - directly to OpenAI without manual chunking
2. **Web search capabilities** - without requiring SERPAPI integration
3. **Conversation state management** - within a single API call

## Implementation Details

The prototype consists of:

- `lib/openai.ts`: Added a new function `reviewPlanWithResponsesAPI`
- `app/api/plan-review-responses/route.ts`: New API route for handling plan reviews
- `app/api/test-responses-api/route.ts`: Test route to verify the implementation
- `app/api/send-email/route.ts`: Updated to support direct base64 file uploads
- `public/sample-plans.pdf`: Sample PDF for testing

## Testing Instructions

### Using the Test API Endpoint

1. Start the development server:
   ```
   npm run dev
   ```

2. Access the test endpoint:
   ```
   curl http://localhost:3000/api/test-responses-api
   ```

This will:
- Load a sample PDF from the public directory
- Submit it to the Responses API prototype
- Return the results

### Direct API Testing

#### Form Data Upload:
```javascript
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('submitterEmail', 'test@example.com');
formData.append('cityPlannerEmail', 'cityplanner@example.com');
formData.append('address', '123 Test Street');
formData.append('parcelNumber', '123456-7890');
formData.append('city', 'Seattle');
formData.append('county', 'King County');

fetch('/api/plan-review-responses', {
  method: 'POST',
  body: formData
})
```

#### Blob URL Upload:
```javascript
fetch('/api/plan-review-responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    blobUrl: 'https://your-blob-url.com/file.pdf',
    submitterEmail: 'test@example.com',
    cityPlannerEmail: 'cityplanner@example.com',
    address: '123 Test Street',
    parcelNumber: '123456-7890',
    city: 'Seattle',
    county: 'King County'
  })
})
```

## Key Advantages

1. **Simplified Code** - Reduces code complexity by handling file uploads and web search natively
2. **Reduced Dependencies** - Eliminates the need for SERPAPI integration
3. **Improved Reliability** - Uses OpenAI's built-in file handling capabilities
4. **Easier Maintenance** - Single API call reduces state management complexity

## Next Steps

- Compare performance metrics between implementations
- Conduct thorough testing with real architectural plans
- Decide whether to fully migrate to the Responses API

For detailed documentation, see `docs/responses-api-prototype.md`. 