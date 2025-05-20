# OpenAI Responses API Prototype for CivicStream

This document provides an overview of CivicStream's architectural plan review system using OpenAI's new Responses API. The prototype maintains feature parity with the existing solution while leveraging the new API's capabilities for file handling and web search.

## Quick Links

- [Implementation Guide](responses-api-implementation.md) - Detailed implementation architecture and setup
- [API Reference](responses-api-reference.md) - Complete API documentation and specifications
- [Testing Guide](responses-api-testing.md) - Testing procedures and validation
- [Migration Guide](responses-api-migration.md) - Migration strategy and procedures

## Overview

The prototype implements a parallel architecture that can be tested alongside the existing system. It demonstrates how the Responses API can simplify our codebase by natively handling:

1. **PDF file uploads** directly to OpenAI
2. **Web search capabilities** without requiring a SERPAPI integration
3. **Conversation state management** within a single API call

## High-Level Architecture

### Core Components

1. **API Routes**
   - `/api/plan-review-responses` - Main processing endpoint
   - `/api/test-responses-api` - Testing endpoint

2. **Key Functions**
   - `reviewPlanWithResponsesAPI` - Core processing function
   - File handling utilities
   - Email generation

3. **External Services**
   - OpenAI Responses API
   - Email service
   - File storage

### Workflow

1. **Upload** - User uploads a PDF of architectural plans
2. **Process** - Plan is sent to OpenAI using the Responses API
3. **Delivery** - Results are sent via email

## Key Advantages

1. **Simplified Code**
   - Native file handling
   - Built-in web search
   - Reduced state management

2. **Improved Performance**
   - Faster processing times
   - Lower resource usage
   - Reduced costs

3. **Better Maintainability**
   - Fewer dependencies
   - Simpler error handling
   - Clearer code structure

## Known Limitations

1. The Responses API is still in beta, and its behavior may change
2. There's less granular control over the web search behavior compared to our custom SERPAPI integration
3. File size limitations may differ from our current chunking approach
4. The response format might require additional validation

## Next Steps

1. Review the [Implementation Guide](responses-api-implementation.md) for setup instructions
2. Consult the [API Reference](responses-api-reference.md) for integration details
3. Follow the [Testing Guide](responses-api-testing.md) to validate the implementation
4. Use the [Migration Guide](responses-api-migration.md) when ready to deploy

## Support

For questions or issues:
1. Check the relevant documentation section
2. Review the [Testing Guide](responses-api-testing.md) for common issues
3. Contact the development team
4. Submit an issue on GitHub 