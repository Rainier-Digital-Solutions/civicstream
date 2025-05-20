# Responses API Testing Guide

This document provides comprehensive testing procedures for the CivicStream architectural plan review system using OpenAI's Responses API.

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Test Endpoint](#test-endpoint)
3. [Manual Testing](#manual-testing)
4. [Test Cases](#test-cases)
5. [Test Results Validation](#test-results-validation)
6. [Test Reporting](#test-reporting)

## Test Environment Setup

### Prerequisites
1. Node.js 18+ installed
2. OpenAI API key configured
3. Development server running (`npm run dev`)
4. Sample PDF files for testing

### Test Data Requirements
- PDF files should be valid architectural plans
- File size should be under 100MB
- Files should contain readable text (not scanned images)
- Test with various plan types:
  - Residential building plans
  - Commercial building plans
  - Renovation plans
  - Site plans

## Test Endpoint

The test endpoint at `/api/test-responses-api` provides automated testing capabilities:

### Test Flow
1. Loads a sample PDF from the public directory
2. Submits it to the Responses API route
3. Returns comprehensive test results

### Test Results Format
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

### Verification Steps
1. Check response status code (should be 200)
2. Verify `success` is true
3. Validate `testResult` structure
4. Review findings for accuracy
5. Check email templates in the response

## Manual Testing

### 1. Direct File Upload Testing

```typescript
// Test with a local PDF file
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('submitterEmail', 'test@example.com');
formData.append('cityPlannerEmail', 'planner@example.com');
formData.append('address', '123 Test St');
formData.append('parcelNumber', 'TEST-123');
formData.append('city', 'Seattle');
formData.append('county', 'King County');

const response = await fetch('/api/plan-review-responses', {
  method: 'POST',
  body: formData
});

// Verify response
const result = await response.json();
console.log('Test Results:', result);
```

### 2. Blob URL Testing

```typescript
// Test with a blob URL
const response = await fetch('/api/plan-review-responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    blobUrl: 'https://your-blob-url.com/test-plan.pdf',
    submitterEmail: 'test@example.com',
    cityPlannerEmail: 'planner@example.com',
    address: '123 Test St',
    parcelNumber: 'TEST-123',
    city: 'Seattle',
    county: 'King County'
  })
});

// Verify response
const result = await response.json();
console.log('Test Results:', result);
```

## Test Cases

### 1. Basic Functionality
- [ ] PDF upload works
- [ ] Response format is correct
- [ ] Email templates are generated
- [ ] Findings are properly categorized

### 2. Error Handling
- [ ] Invalid file type rejected
- [ ] Missing required fields handled
- [ ] Large files handled gracefully
- [ ] Network errors recovered from

### 3. Edge Cases
- [ ] Empty PDFs
- [ ] Corrupted PDFs
- [ ] Very large PDFs
- [ ] PDFs with only images
- [ ] PDFs with mixed content

### 4. Performance Testing
- [ ] Response time under 5 minutes
- [ ] Memory usage within limits
- [ ] Concurrent request handling
- [ ] Resource cleanup

## Test Results Validation

### 1. Response Validation
- Check all required fields are present
- Verify data types are correct
- Ensure findings are properly categorized
- Validate email template formatting

### 2. Content Validation
- Review findings for accuracy
- Check code references are valid
- Verify email content is appropriate
- Ensure recommendations are actionable

### 3. Error Logging
- Check error messages are descriptive
- Verify error codes are correct
- Ensure stack traces are logged
- Validate error recovery works

## Test Reporting

### 1. Test Summary
- Number of tests run
- Pass/fail statistics
- Error counts by type
- Performance metrics

### 2. Issue Tracking
- Document any failures
- Note unexpected behavior
- Track performance issues
- Record edge case handling

### 3. Performance Metrics
- Average response time
- Memory usage patterns
- CPU utilization
- Network I/O statistics

### 4. Test Coverage
- API endpoint coverage
- Error handling coverage
- Edge case coverage
- Performance scenario coverage

## Automated Testing

### 1. Unit Tests
```typescript
describe('Plan Review API', () => {
  test('handles valid PDF upload', async () => {
    // Test implementation
  });

  test('rejects invalid file types', async () => {
    // Test implementation
  });

  test('handles missing required fields', async () => {
    // Test implementation
  });
});
```

### 2. Integration Tests
```typescript
describe('End-to-End Tests', () => {
  test('complete plan review workflow', async () => {
    // Test implementation
  });

  test('email delivery workflow', async () => {
    // Test implementation
  });
});
```

### 3. Performance Tests
```typescript
describe('Performance Tests', () => {
  test('handles concurrent requests', async () => {
    // Test implementation
  });

  test('processes large files', async () => {
    // Test implementation
  });
});
```

## Related Documentation
- [Implementation Guide](responses-api-implementation.md)
- [API Reference](responses-api-reference.md)
- [Migration Guide](responses-api-migration.md) 