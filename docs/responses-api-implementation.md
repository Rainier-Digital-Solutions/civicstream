# Responses API Implementation Guide

This document provides detailed implementation information for the CivicStream architectural plan review system using OpenAI's Responses API.

## Table of Contents

1. [Implementation Details](#implementation-details)
2. [Core Architecture](#core-architecture)
3. [Error Handling](#error-handling)
4. [File Handling](#file-handling)
5. [Environment Setup](#environment-setup)

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

## Core Architecture

The implementation uses a two-phase approach to process architectural plans:

### Phase 1: Search and Analysis
1. **File Upload and Vector Store Creation**
   - PDF is uploaded directly to OpenAI using the Files API
   - A vector store is created to enable semantic search within the document
   - The vector store is used to extract relevant information from the plans

2. **Web Search Integration**
   - Native web search is performed to find relevant building codes
   - Search results are combined with plan information for comprehensive analysis

### Phase 2: Review Generation
1. **Structured Analysis**
   - The system processes the combined information from Phase 1
   - Generates a structured review following the required format
   - Creates HTML email templates for both city planner and submitter

## Error Handling

The implementation includes robust error handling:

### Retry Logic
- Maximum of 3 retry attempts for failed API calls
- Exponential backoff between retries (1s, 2s, 3s)
- Automatic fallback to default response on persistent failures

### Resource Cleanup
- Vector stores are automatically deleted after use
- Uploaded files are removed from OpenAI's servers
- Temporary files are cleaned up from the local system

### Error Recovery
- Default response provided when processing fails
- Detailed error logging for debugging
- Graceful degradation of service

## File Handling

The system supports two methods of file upload:

### Direct Upload
- Handles multipart/form-data submissions
- Validates PDF content type
- Processes files up to OpenAI's size limits

### Blob URL Processing
- Supports existing blob URL workflow
- Downloads and processes remote files
- Maintains compatibility with current upload mechanism

## Environment Setup

### Prerequisites
1. Node.js 18+ installed
2. OpenAI API key
3. Development environment configured

### Configuration Steps
1. **Environment Variables**
   ```bash
   OPENAI_API_KEY=your_api_key_here
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
   ```

2. **Dependencies**
   ```bash
   npm install openai @vercel/blob
   ```

3. **Development Server**
   ```bash
   npm run dev
   ```

### Security Considerations
1. **API Key Management**
   - Store API keys in environment variables
   - Never commit API keys to version control
   - Rotate keys regularly

2. **File Security**
   - Validate file types
   - Check file sizes
   - Sanitize file names
   - Clean up temporary files

3. **Error Handling**
   - Log errors securely
   - Don't expose sensitive information
   - Implement rate limiting

### Best Practices
1. **Code Organization**
   - Keep functions small and focused
   - Use TypeScript for type safety
   - Follow consistent naming conventions

2. **Error Handling**
   - Use try-catch blocks
   - Implement proper logging
   - Provide meaningful error messages

3. **Performance**
   - Clean up resources promptly
   - Implement caching where appropriate
   - Monitor memory usage

## Related Documentation
- [API Reference](responses-api-reference.md)
- [Testing Guide](responses-api-testing.md)
- [Migration Guide](responses-api-migration.md) 