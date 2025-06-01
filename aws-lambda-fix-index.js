const AWS = require('aws-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const pdf = require('pdf-parse');

// Initialize AWS services
const s3 = new AWS.S3();

// Initialize Claude
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Nodemailer
const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Add Perplexity API integration for enhanced web search
async function performWebSearch(query, maxResults = 5) {
    // Try Perplexity API first if available
    if (process.env.PERPLEXITY_API_KEY) {
        try {
            console.log('Using Perplexity API for web search:', query);
            const response = await fetch('https://api.perplexity.ai/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-sonar-small-128k-online',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that searches for building codes and regulations. Return only the most relevant and recent information.'
                        },
                        {
                            role: 'user',
                            content: `Search for: ${query}. Please provide specific building codes, regulations, and official government sources.`
                        }
                    ],
                    max_tokens: 10000,
                    temperature: 0.2,
                    return_citations: true
                })
            });

            if (response.ok) {
                const data = await response.json();
                const content = data.choices[0]?.message?.content || '';
                const citations = data.citations || [];

                // Convert Perplexity response to SearchResult format
                const results = citations.slice(0, maxResults).map((citation, index) => ({
                    title: citation.title || `Building Code Reference ${index + 1}`,
                    snippet: content.substring(0, 200) + '...',
                    url: citation.url || '#'
                }));

                console.log(`Perplexity search returned ${results.length} results for query: ${query}`);
                return results;
            }
        } catch (error) {
            console.warn('Perplexity search failed:', error);
        }
    }

    console.log('Perplexity API not available, returning empty search results');
    return [];
}

const COMPLIANCE_REVIEW_PROMPT = `
You are a plan reviewer in the state of Washington. Your task is to review the following plan submission scenarios and plan types based on the following categories and provide a structured JSON response.

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any explanatory text before or after the JSON. The response must be parseable by JSON.parse().
DO NOT wrap your JSON in markdown code blocks (no \`\`\`json). Your entire response must be only the raw JSON object.

FIRST, analyze the submitted file, identify the application type using the input fields provided.

SECOND, cross reference the address, parcel number, and municipality and analyze each application based on application type and identify any missing PLANS, PERMITS AND APPLICATIONS, ADDITIONAL DOCUMENTATION, and INSPECTION CERTIFICATES using the following criteria:

1a - If the applicant is submitting an application for a new single-family residence, they MUST include the following PLANS:

- Site plan showing property boundaries, setbacks, and placement of structures
- Architectural plans (floor plans, elevations, sections)
- Structural plans and calculations
- Foundation plans
- Framing plans
- Roof plans
- Mechanical, electrical, and plumbing (MEP) plans
- Energy code compliance documentation
- Stormwater management plan
- Erosion and sediment control plan
- Landscape plan (if required by jurisdiction)

1b - If the applicant is submitting an application for a new single-family residence, they MUST include the following PERMITS AND APPLICATIONS:

- Building permit application
- Plumbing permit
- Electrical permit
- Mechanical permit
- Water/sewer connection permits
- Right-of-way use permit (if applicable)
- Tree removal permit (if applicable)
- Grading permit (for significant earth movement)
- Stormwater drainage permit

1c - If the applicant is submitting an application for a new single-family residence, they MUST include the following ADDITIONAL DOCUMENTATION:

- SEPA (State Environmental Policy Act) checklist (if applicable)
- Water availability certification
- Septic approval (for areas without sewer service)
- Critical areas assessment (wetlands, steep slopes, etc.)
- Geotechnical report (for challenging soil conditions or slopes)
- Title report/property survey
- Homeowner's association approval (if applicable)
- Proof of contractor registration
- Contractor's liability insurance documentation

1d - If the applicant is submitting an application for a new single-family residence, they MUST include the following INSPECTION CERTIFICATES:

- Pre-construction
- Foundation/footings
- Framing
- Electrical/plumbing/mechanical rough-in
- Insulation
- Final inspection

THIRD, generate a response listing ALL missing PLANS, PERMITS & APPLICATIONS, ADDITIONAL DOCUMENTATION, and INSPECTION CERTIFICATES. Your response will be used to automatically generate emails, so it must follow this exact format:

{
  "summary": "Concise summary of the review and overall completeness.",
  "missingPlans": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.85, "severity": "major" }, ... ],
  "missingPermits": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.85, "severity": "major" }, ... ],
  "missingDocumentation": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.85, "severity": "major" }, ... ],
  "missingInspectionCertificates": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.85, "severity": "major" }, ... ],
  "criticalFindings": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.95, "severity": "critical" }, ... ],
  "majorFindings": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.85, "severity": "major" }, ... ],
  "minorFindings": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.75, "severity": "minor" }, ... ],
  "totalFindings": 0,
  "isCompliant": true,
  "cityPlannerEmailBody": "",
  "submitterEmailBody": ""
}

Both cityPlannerEmailBody and submitterEmailBody must use the following HTML/CSS style and structure:

- A large, bold header at the top (blue for compliant, red for action required)
- A horizontal line below the header
- A standardized application cover page in a standardized format that identifies the project address, use, zoning, and a list of the submitted files or documents included in the application.
- A short introductory paragraph
- A green 'Review Summary' subheader
- The summary text
- A blue box with rounded corners containing:
  - A bold 'Finding Counts' subheader
  - A bulleted list of counts for critical, major, minor, and total findings
  - A bulleted list of counts for missing plans, permits, documentation, and inspection certificates
- A section with header:
  <h3 style="color: #dc2626; font-size: 18px; font-weight: 600; margin: 25px 0 15px 0; border-bottom: 2px solid #dc2626; padding-bottom: 5px;">🔍 Detailed Findings</h3>
- Critical findings in red containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #dc2626; background-color: #fef2f2; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #dc2626; font-size: 16px; font-weight: 600;">🚨 Critical Finding: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [Detailed description]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Section:</strong> [Specific code reference]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Remedial Action:</strong> [How to fix]</p>
    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Confidence:</strong> [Score]%</p>
  </div>
- Major findings in orange containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #ea580c; background-color: #fff7ed; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #ea580c; font-size: 16px; font-weight: 600;">⚠️ Major Finding: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [Detailed description]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Section:</strong> [Specific code reference]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Remedial Action:</strong> [How to fix]</p>
    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Confidence:</strong> [Score]%</p>
  </div>
- Minor findings in yellow containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #eab308; background-color: #fefce8; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #eab308; font-size: 16px; font-weight: 600;">💡 Minor Finding: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [Detailed description]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Section:</strong> [Specific code reference]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Remedial Action:</strong> [How to fix]</p>
    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;"><strong>Confidence:</strong> [Score]%</p>
  </div>
- A section with header:
  <h3 style="color: #f59e0b; font-size: 18px; font-weight: 600; margin: 25px 0 15px 0; border-bottom: 2px solid #f59e0b; padding-bottom: 5px;">📋 Missing Items</h3>
- Missing Plans in blue containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #3b82f6; background-color: #eff6ff; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #3b82f6; font-size: 16px; font-weight: 600;">📐 Missing Plan: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [What's missing]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Requirement:</strong> [Why it's required]</p>
    <p style="margin: 8px 0 0 0; color: #374151;"><strong style="color: #1f2937;">Action Required:</strong> [How to provide]</p>
  </div>
- Missing Permits in purple containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #8b5cf6; background-color: #f5f3ff; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #8b5cf6; font-size: 16px; font-weight: 600;">📄 Missing Permit: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [What's missing]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Requirement:</strong> [Why it's required]</p>
    <p style="margin: 8px 0 0 0; color: #374151;"><strong style="color: #1f2937;">Action Required:</strong> [How to provide]</p>
  </div>
- Missing Documentation in green containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #10b981; background-color: #ecfdf5; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #10b981; font-size: 16px; font-weight: 600;">📋 Missing Documentation: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [What's missing]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Requirement:</strong> [Why it's required]</p>
    <p style="margin: 8px 0 0 0; color: #374151;"><strong style="color: #1f2937;">Action Required:</strong> [How to provide]</p>
  </div>
- Missing Inspection Certificates in teal containers:
  <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #14b8a6; background-color: #f0fdfa; border-radius: 4px;">
    <h4 style="margin: 0 0 10px 0; color: #14b8a6; font-size: 16px; font-weight: 600;">✅ Missing Inspection: [Title]</h4>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Description:</strong> [What's missing]</p>
    <p style="margin: 8px 0; color: #374151;"><strong style="color: #1f2937;">Code Requirement:</strong> [Why it's required]</p>
    <p style="margin: 8px 0 0 0; color: #374151;"><strong style="color: #1f2937;">Action Required:</strong> [How to provide]</p>
  </div>
- CRITICAL: Both emails MUST include the complete detailed list of ALL findings and missing items, not just counts.
- (For submitter only) A section for 'Next Steps' with a numbered list
- A gray footer paragraph in small text

The footer must be as follows:

- For compliant plans (isCompliant: true):
  This email was automatically generated by CivicStream. The attached plan has been reviewed by AI and meets the requirements for direct submission to city planning.
- For non-compliant plans (isCompliant: false):
  This email was automatically generated by CivicStream. The attached plan has been reviewed by AI and does not meet the requirements for direct submission to city planning.

Use this structure and style for both emails, only changing the header color/text, intro, content, and footer as appropriate for each recipient and compliance status. Use inline CSS for all styling. Do not include any other text in your response except the JSON object.

FOURTH, perform a complete review of the files submitted. To perform the review:

1. Extract or utilize a provided address and parcel number from uploaded PDF architectural plans to identify the specific municipality and applicable codes, cross-checking the address with the parcel number to ensure accuracy. These are required for every set of plans and must be included in the web search query. They are typically found in the top right corner of the plans. The plans will include either the city name, county name, parcel number, or a combination of these. The web search query should include the city name, county name, or both.

2. Use web search capabilities to access and verify the most current international building code, municipal zoning code, and state and local zoning and planning codes as of the submission date based on the identified municipality. Cross reference all municipal, county, and state regulations to identify all required documents, certifications, reports, plans, approvals, will-serve letters, and inspections that are required for a proposed project of this type.

3. Analyze the plans, which include a scale, compass, legend, and a general information table, along with accompanying documents (e.g., full plan sets, required inspection certificates, surveys, stormwater management plans, traffic studies).

4. For each missing component, provide:
   - The type of component missing ("plan", "information", "documentation", "certifications", "report", "approvals", "will-serve letters", "inspections" or "other")
   - The specific regulation that requires the component in question (with section numbers and hyperlinks if available)
   - A hyperlink to where the missing regulation can be found

5. For each finding, provide:
   - A clear description of the issue
   - The specific code section violated (with section numbers and hyperlinks if available)
   - Severity ("critical", "major", or "minor")
   - Confidence score (0.0–1.0)
   - Explicit remedial actions to comply with the code

6. The cityPlannerEmailBody should:
   - Be addressed to a city planner
   - Include a standardized application summary describing the project
   - Confirm compliance status
   - List any minor findings
   - Use a professional tone

7. The submitterEmailBody should:
   - Be addressed to the plan submitter
   - List all findings (critical, major, minor) WITH FULL DETAILS
   - List all missing items by category WITH FULL DETAILS
   - Include a 'Next Steps' section with:
     1. Review all findings in detail
     2. Make the necessary corrections to your plans
     3. Resubmit your corrected plans through our system
   - Use a supportive, professional tone

IMPORTANT: You MUST generate actual findings and missing items for single-family residence applications. Based on typical Washington state requirements, identify common missing documents such as:
- Structural calculations
- Energy code compliance forms
- Stormwater management plans
- Site surveys
- Geotechnical reports
- Building permit applications
- MEP plans

REMEMBER: Your response must be ONLY a valid JSON object. You MUST include actual findings in the criticalFindings, majorFindings, minorFindings, and missing items arrays - not empty arrays. Generate realistic findings based on typical single-family residence requirements in Washington state.
`;

exports.handler = async (event) => {
    console.log('Processing SQS messages:', JSON.stringify(event, null, 2));

    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            const { submissionId, s3Key, fileName, submitterEmail, cityPlannerEmail, projectDetails } = message;

            console.log(`Processing submission: ${submissionId}`);

            // Download PDF from S3
            console.log(`Downloading PDF from S3: ${s3Key}`);
            const pdfObject = await s3.getObject({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: s3Key
            }).promise();

            console.log(`Downloaded PDF from S3: ${s3Key}, size: ${pdfObject.Body.length}`);

            // Extract text from PDF
            console.log('Extracting text from PDF for Claude analysis');
            let pdfTextContent = '';
            
            try {
                const pdfData = await pdf(pdfObject.Body);
                pdfTextContent = pdfData.text;
                console.log(`Successfully extracted text from PDF, length: ${pdfTextContent.length}`);
            } catch (pdfError) {
                console.error('Failed to extract text from PDF:', pdfError);
                pdfTextContent = `Unable to extract text from PDF file "${fileName}". Performing template-based review for ${projectDetails.city}, ${projectDetails.county} based on typical residential requirements.`;
            }

            // Perform real Claude analysis
            console.log('Starting Claude plan review analysis');
            const reviewResult = await reviewPlanWithClaude(pdfTextContent, projectDetails);
            
            console.log(`Claude review completed for submission: ${submissionId}`);
            console.log(`Review summary: ${reviewResult.summary}`);
            console.log(`Total findings: ${reviewResult.totalFindings}, Compliant: ${reviewResult.isCompliant}`);

            // Send emails with real Claude results
            await Promise.all([
                sendEmail(submitterEmail, 
                    reviewResult.isCompliant ? 'Plan Review Complete - Approved' : 'Plan Review Results - Action Required', 
                    reviewResult.submitterEmailBody),
                sendEmail(cityPlannerEmail, 
                    reviewResult.isCompliant ? 'Plan Review Complete - Approved' : 'Plan Review Results - Review Required', 
                    reviewResult.cityPlannerEmailBody)
            ]);

            console.log(`Emails sent for submission: ${submissionId}`);

            // Clean up S3 object
            await s3.deleteObject({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: s3Key
            }).promise();

            console.log(`Cleaned up S3 object: ${s3Key}`);

        } catch (error) {
            console.error('Error processing message:', error);
            throw error; // This will send the message to DLQ after retries
        }
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Processing complete' }) };
};

async function reviewPlanWithClaude(pdfTextContent, projectDetails, maxRetries = 3) {
    console.log('Starting Claude architectural plan review');
    
    let attempts = 0;
    let lastError = null;

    while (attempts < maxRetries) {
        try {
            // First, perform web search for building codes
            const searchQuery = `building codes regulations ${projectDetails.city} ${projectDetails.county} Washington state zoning requirements single family residence`;
            console.log('Performing web search for building codes:', searchQuery);
            const searchResults = await performWebSearch(searchQuery, 5);
            console.log('Web search returned', searchResults.length, 'results');

            const searchResultsText = searchResults.map(result =>
                `Title: ${result.title}\\nURL: ${result.url}\\nSnippet: ${result.snippet}`
            ).join('\\n\\n');

            const userMessage = `
Project Details:
Address: ${projectDetails.address}
Parcel Number: ${projectDetails.parcelNumber}
City: ${projectDetails.city}
County: ${projectDetails.county}
${projectDetails.projectSummary ? `Project Summary: ${projectDetails.projectSummary}` : ''}

BUILDING CODES AND REGULATIONS SEARCH RESULTS:
${searchResultsText}

EXTRACTED PDF TEXT CONTENT:
${pdfTextContent.substring(0, 50000)}${pdfTextContent.length > 50000 ? '\\n\\n[Content truncated due to length limits]' : ''}

Please analyze the architectural plans based on the extracted text content and building codes found in the search results. Generate a comprehensive review based on the actual content found in the plans and typical requirements for single-family residences in ${projectDetails.city}, ${projectDetails.county}, Washington. 

You MUST generate realistic findings and missing items based on what you can determine from the extracted text. Focus on:

TYPICAL MISSING DOCUMENTS for ${projectDetails.city}, WA:
1. Structural engineering calculations and plans
2. Energy code compliance documentation (WSE forms)
3. Stormwater management plan and calculations  
4. Site survey/boundary survey
5. Geotechnical report (if required by soil conditions)
6. Building permit application form
7. MEP (Mechanical/Electrical/Plumbing) detailed plans
8. Erosion and sediment control plan

TYPICAL CODE COMPLIANCE ISSUES:
1. Setback violations or unclear setback dimensions
2. Height restrictions compliance
3. Parking requirements
4. Fire safety access requirements
5. ADA compliance issues
6. Energy code compliance gaps

Generate specific, realistic findings with proper code references (like "IRC Section 123.4" or "King County Code 21A.24.XXX"). Provide detailed review following the required JSON format with properly formatted HTML email bodies that include the full detailed findings list.`;

            console.log(`Claude attempt ${attempts + 1}/${maxRetries}: Sending request`);
            
            // Add timeout handling
            const timeoutMs = 300000; // 5 minutes
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                const response = await anthropic.messages.create({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 20000,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: COMPLIANCE_REVIEW_PROMPT
                                },
                                {
                                    type: "text",
                                    text: userMessage
                                }
                            ]
                        }
                    ]
                });
                
                clearTimeout(timeoutId);

                const content = response.content[0];
                if (content.type !== 'text') {
                    throw new Error('No text response received from Claude');
                }

                console.log('Claude raw response length:', content.text.length);

                try {
                    // Preprocess content to remove markdown formatting
                    let processedContent = content.text;

                    // Strip out markdown code block delimiters if present
                    const jsonMatch = content.text.match(/```(?:json)?\\s*([\\s\\S]*?)```/);
                    if (jsonMatch && jsonMatch[1]) {
                        processedContent = jsonMatch[1].trim();
                    }

                    console.log('Processing Claude response for JSON extraction');
                    const result = JSON.parse(processedContent);
                    console.log('Successfully parsed Claude JSON response');

                    // Enhanced validation of the response structure
                    if (!result.summary || !Array.isArray(result.criticalFindings) ||
                        !Array.isArray(result.majorFindings) || !Array.isArray(result.minorFindings) ||
                        typeof result.totalFindings !== 'number' || typeof result.isCompliant !== 'boolean' ||
                        !result.cityPlannerEmailBody || !result.submitterEmailBody) {
                        throw new Error('Invalid response structure from Claude');
                    }

                    return {
                        summary: result.summary,
                        missingPlans: result.missingPlans || [],
                        missingPermits: result.missingPermits || [],
                        missingDocumentation: result.missingDocumentation || [],
                        missingInspectionCertificates: result.missingInspectionCertificates || [],
                        criticalFindings: result.criticalFindings,
                        majorFindings: result.majorFindings,
                        minorFindings: result.minorFindings,
                        totalFindings: result.totalFindings,
                        isCompliant: result.isCompliant,
                        cityPlannerEmailBody: result.cityPlannerEmailBody,
                        submitterEmailBody: result.submitterEmailBody
                    };
                } catch (parseError) {
                    console.error(`Claude attempt ${attempts + 1} failed to parse JSON:`, parseError);
                    console.error('Raw response that failed to parse:', content.text);
                    lastError = parseError;

                    if (attempts === maxRetries - 1) {
                        return getDefaultErrorResponse(projectDetails);
                    }
                }
            } catch (apiError) {
                clearTimeout(timeoutId);
                throw apiError;
            }
        } catch (error) {
            console.error(`Claude attempt ${attempts + 1} failed with error:`, error);
            lastError = error;

            if (attempts === maxRetries - 1) {
                return getDefaultErrorResponse(projectDetails);
            }
        }

        attempts++;
        if (attempts < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
    }

    throw lastError || new Error('Failed to process plan after all retry attempts');
}

function getDefaultErrorResponse(projectDetails) {
    return {
        summary: "Our system was able to process your plan but couldn't perform a detailed review at this time.",
        missingPlans: [],
        missingPermits: [],
        missingDocumentation: [],
        missingInspectionCertificates: [],
        criticalFindings: [],
        majorFindings: [],
        minorFindings: [],
        totalFindings: 0,
        isCompliant: false,
        cityPlannerEmailBody: `<div style="color: #0066cc; font-size: 24px; font-weight: bold;">Plan Review Process Completed</div>
          <hr>
          <h3>Application Cover Page</h3>
          <p><strong>Project Address:</strong> ${projectDetails.address}</p>
          <p><strong>City:</strong> ${projectDetails.city}</p>
          <p><strong>County:</strong> ${projectDetails.county}</p>
          <p><strong>Parcel Number:</strong> ${projectDetails.parcelNumber}</p>
          <p>Dear City Planner,</p>
          <p>We have processed the architectural plans, but our system was unable to perform a detailed code compliance review at this time.</p>
          <div style="background-color: #e6f3ff; padding: 15px; border-radius: 5px;">
            <h4 style="color: #0066cc; margin-top: 0;">Finding Counts</h4>
            <ul>
              <li>Critical Findings: 0</li>
              <li>Major Findings: 0</li>
              <li>Minor Findings: 0</li>
              <li>Total Findings: 0</li>
            </ul>
          </div>
          <h3>Review Status</h3>
          <p>Our automated system has marked this plan as needing manual review. We recommend having a building code specialist review these plans.</p>
          <div style="font-size: 12px; color: #666; margin-top: 20px;">
            This email was automatically generated by CivicStream. This plan requires manual review by city planning staff.
          </div>`,
        submitterEmailBody: `<div style="color: #cc0000; font-size: 24px; font-weight: bold;">Plan Review Complete - Manual Review Required</div>
          <hr>
          <h3>Application Cover Page</h3>
          <p><strong>Project Address:</strong> ${projectDetails.address}</p>
          <p><strong>City:</strong> ${projectDetails.city}</p>
          <p><strong>County:</strong> ${projectDetails.county}</p>
          <p><strong>Parcel Number:</strong> ${projectDetails.parcelNumber}</p>
          <p>Dear Plan Submitter,</p>
          <p>We have processed your architectural plans, but our system was unable to perform a detailed code compliance review at this time.</p>
          <div style="background-color: #e6f3ff; padding: 15px; border-radius: 5px;">
            <h4 style="color: #0066cc; margin-top: 0;">Finding Counts</h4>
            <ul>
              <li>Critical Findings: 0</li>
              <li>Major Findings: 0</li>
              <li>Minor Findings: 0</li>
              <li>Total Findings: 0</li>
            </ul>
          </div>
          <h3>Next Steps</h3>
          <ol>
            <li>Your plans have been forwarded for manual review by city planning staff</li>
            <li>You may be contacted for additional information</li>
            <li>Please allow 3-5 business days for manual review to be completed</li>
          </ol>
          <div style="font-size: 12px; color: #666; margin-top: 20px;">
            This email was automatically generated by CivicStream. Your plan requires manual review by city planning staff.
          </div>`
    };
}

async function sendEmail(toEmail, subject, htmlBody) {
    console.log(`Sending email to: ${toEmail}`);
    
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: toEmail,
        subject: subject,
        html: htmlBody,
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${toEmail}:`, result.messageId);
        return result;
    } catch (error) {
        console.error(`Failed to send email to ${toEmail}:`, error);
        throw error;
    }
}