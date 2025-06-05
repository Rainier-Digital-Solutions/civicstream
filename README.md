# CivicStream

CivicStream is an innovative architectural plan review system that leverages AI to streamline the building permit process. Our platform helps city planners and architects work together more efficiently by automating code compliance checks and providing clear, actionable feedback.

## Overview

CivicStream uses Anthropic's Claude AI to analyze architectural plans and provide comprehensive code compliance reviews. The system operates on AWS infrastructure with a Next.js frontend hosted on Vercel.

### Architecture

- **Frontend**: Next.js application hosted on Vercel
- **Backend**: AWS Lambda functions for processing
- **Storage**: S3 for temporary file storage
- **Processing**: SQS queues for background job processing
- **AI Processing**: Anthropic Claude for plan analysis
- **Web Search**: Perplexity API for building code research
- **Email**: Nodemailer with SMTP for notifications

## Key Features

- **Automated Plan Review**: Claude AI-powered analysis of architectural plans
- **S3 Presigned Upload**: Secure, direct file uploads to AWS S3
- **Background Processing**: Asynchronous processing using SQS and Lambda
- **Code Compliance**: Checks against Washington state building codes and regulations
- **Professional Communication**: Automated HTML email notifications
- **Web Search Integration**: Real-time building code research via Perplexity API
- **File Handling**: Support for large PDF uploads (up to 50MB)

## Infrastructure

### AWS Services Used

- **Lambda Functions**:
  - `upload-handler`: Manages S3 presigned URLs and triggers processing
  - `plan-processor`: Processes PDFs using Claude AI and sends emails
- **S3 Bucket**: Temporary storage for uploaded plans (auto-cleanup after 24 hours)
- **SQS Queue**: Background job processing with dead letter queue
- **API Gateway**: HTTP API for frontend communication
- **CloudWatch**: Logging and monitoring

### Deployment

The infrastructure is managed using Terraform located in `../aws-infrastructure/`.

## Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured
- Terraform (for infrastructure deployment)
- API keys:
  - Anthropic API key
  - Perplexity API key (optional)
  - Email service credentials

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/Rainier-Digital-Solutions/civicstream.git
   cd civic-stream
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

### AWS Infrastructure Deployment

1. Navigate to the infrastructure directory:

   ```bash
   cd ../aws-infrastructure
   ```

2. Initialize Terraform:

   ```bash
   terraform init
   ```

3. Deploy infrastructure:

   ```bash
   terraform apply
   ```

## Workflow

1. **File Upload**: User uploads PDF via presigned S3 URL
2. **Queue Processing**: Upload triggers SQS message for background processing
3. **AI Analysis**: Lambda function downloads PDF and analyzes with Claude
4. **Code Research**: Perplexity API searches for relevant building codes
5. **Email Generation**: Results formatted into HTML emails
6. **Delivery**: Emails sent to submitter and city planner
7. **Cleanup**: Temporary files removed from S3

## Environment Variables

### Frontend (.env.local)

```bash
# AWS endpoint for uploads (hardcoded in development)
NEXT_PUBLIC_AWS_UPLOAD_ENDPOINT=https://v9cmp61l9d.execute-api.us-west-2.amazonaws.com/prod/upload-handler
```

### Lambda Environment Variables

```bash
ANTHROPIC_API_KEY=your_claude_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
S3_BUCKET_NAME=civicstream-plan-storage-xxxx
SQS_QUEUE_URL=your_sqs_queue_url
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=your_email@domain.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=CivicStream Smart Routing <routing@civicstream.io>
```

## Documentation

- [AWS Architecture Guide](docs/aws-architecture-guide.md) - Complete infrastructure overview and deployment guide
- [Claude AI Implementation](docs/prompt-updates-summary.md) - Details on AI processing and prompts

## Support

For support, please:

1. Check the AWS CloudWatch logs for error details
2. Open an issue on GitHub
3. Contact our support team at support@civicstream.com

## About CivicStream

CivicStream is dedicated to modernizing the building permit process through AI-powered automation. Our mission is to make the permitting process more efficient, transparent, and accessible for both city planners and architects.

Learn more about us at [civicstream.com](https://www.civicstream.com)
