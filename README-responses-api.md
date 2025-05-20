# CivicStream

CivicStream is an innovative architectural plan review system that leverages AI to streamline the building permit process. Our platform helps city planners and architects work together more efficiently by automating code compliance checks and providing clear, actionable feedback.

## Overview

CivicStream uses OpenAI's Responses API to analyze architectural plans and provide comprehensive code compliance reviews. The system:

- Automatically reviews architectural plans for code compliance
- Provides detailed feedback with specific code references
- Generates professional email communications
- Integrates with existing city planning workflows

## Key Features

- **Automated Plan Review**: AI-powered analysis of architectural plans
- **Code Compliance**: Checks against local building codes and regulations
- **Professional Communication**: Automated email notifications for both planners and submitters
- **Web Search Integration**: Real-time access to building codes and regulations
- **File Handling**: Native support for PDF plan uploads and processing

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key
- Development environment

### Quick Start

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
   # Edit .env.local with your OpenAI API key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Documentation

Our documentation is organized into several key sections:

- [Implementation Guide](docs/responses-api-implementation.md) - Detailed implementation architecture and setup
- [API Reference](docs/responses-api-reference.md) - Complete API documentation and specifications
- [Testing Guide](docs/responses-api-testing.md) - Testing procedures and validation
- [Migration Guide](docs/responses-api-migration.md) - Migration strategy and procedures

## Support

For support, please:
1. Check our [documentation](docs/)
2. Open an issue on GitHub
3. Contact our support team at support@civicstream.com


## About CivicStream

CivicStream is dedicated to modernizing the building permit process through AI-powered automation. Our mission is to make the permitting process more efficient, transparent, and accessible for both city planners and architects.

Learn more about us at [civicstream.com](https://www.civicstream.com) 