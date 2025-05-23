import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatCompletionTool } from "openai/resources/chat/completions";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// The compliance review prompt
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
- A full, detailed list of all findings, sorted by severity (critical, major, minor) and logically grouped together. Each finding should include its description, code section, severity, confidence score, and remedial action. This detailed list must be present in both emails.
- A full, detailed list of all missing items, sorted by category (plans, permits, documentation, inspection certificates) and logically grouped together.
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
   - List all findings (critical, major, minor)
   - List all missing items by category
   - Include a 'Next Steps' section with:
     1. Review all findings in detail
     2. Make the necessary corrections to your plans
     3. Resubmit your corrected plans through our system
   - Use a supportive, professional tone

REMEMBER: Your response must be ONLY a valid JSON object. Only include the JSON object. If you encounter an error, return an empty array for each finding type as a valid JSON object. You must always return the expected JSON object.
`;

// The metadata extraction prompt
const METADATA_EXTRACTION_PROMPT = `
You are a city plan reviewer for municipalities in the Greater Seattle area. Your current task is to extract essential information from a PDF chunk of architectural plans and provide a structured JSON response. DO NOT perform a full compliance review at this stage.

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any explanatory text before or after the JSON. The response must be parseable by JSON.parse().
DO NOT wrap your JSON in markdown code blocks (no \`\`\`json). Your entire response must be only the raw JSON object.

Extract the following key information from the PDF chunk:
1. Drawing title and number
2. Drawing type (e.g., floor plan, elevation, site plan)
3. Scale information
4. Key dimensions and measurements
5. Relevant specifications or annotations
6. Any code references mentioned in the plans
7. Key building elements visible in this section

Your response must follow this exact format:
{
  "chunkId": "unique-identifier-for-this-chunk",
  "drawingTitle": "The title of the drawing if present",
  "drawingType": "Type of drawing (floor plan, elevation, etc.)",
  "scale": "Scale information if present",
  "keyElements": [
    "List of key building elements, dimensions, or specs visible in this chunk"
  ],
  "codeReferences": [
    "Any code references mentioned in the plans"
  ],
  "rawText": "Important text extracted from the plans"
}

REMEMBER: Your task at this stage is ONLY to extract information, not to evaluate compliance. Keep your response concise and focused on the visible elements in this specific chunk.
`;

// The consolidated review prompt
const CONSOLIDATED_REVIEW_PROMPT = `
You are a plan reviewer in the state of Washington. Your task is to review a consolidated set of architectural plan metadata and provide a structured JSON response.

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any explanatory text before or after the JSON. The response must be parseable by JSON.parse().
DO NOT wrap your JSON in markdown code blocks (no \`\`\`json). Your entire response must be only the raw JSON object.

BEFORE analyzing the plans, you MUST use the web_search function to retrieve the latest building codes and regulations. This is REQUIRED for every review.

You have been provided with metadata extracted from multiple sections of a large architectural plan. You must now perform a comprehensive review based on this metadata.

FIRST, analyze the submitted metadata, identify the application type using the input fields provided.

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
- A standardized application cover page in a standardized format that identifies the project address, use, zoning, and a list of the submitted files or documents included in the application
- A short introductory paragraph
- A green 'Review Summary' subheader
- The summary text
- A blue box with rounded corners containing:
  - A bold 'Finding Counts' subheader
  - A bulleted list of counts for critical, major, minor, and total findings
  - A bulleted list of counts for missing plans, permits, documentation, and inspection certificates
- A full, detailed list of all findings, sorted by severity (critical, major, minor) and logically grouped together. Each finding should include its description, code section, severity, confidence score, and remedial action. This detailed list must be present in both emails.
- A full, detailed list of all missing items, sorted by category (plans, permits, documentation, inspection certificates) and logically grouped together.
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

The cityPlannerEmailBody should:
- Be addressed to a city planner
- Include a standardized application summary describing the project
- Confirm compliance status
- List any minor findings
- Use a professional tone

The submitterEmailBody should:
- Be addressed to the plan submitter
- List all findings (critical, major, minor)
- List all missing items by category
- Include a 'Next Steps' section with:
  1. Review all findings in detail
  2. Make the necessary corrections to your plans
  3. Resubmit your corrected plans through our system
- Use a supportive, professional tone

Your review must be based on the comprehensive understanding of all plan sections together. Look for issues that might only be apparent when considering the entire set of plans as a whole, not just individual sections.

REMEMBER: Your response must be ONLY a valid JSON object with all the required fields. If you encounter an error, return an empty array for each finding type as a valid JSON object.
`;

export interface ReviewFinding {
  description: string;
  codeSection: string;
  severity: "critical" | "major" | "minor";
  confidenceScore: number;
  remedialAction: string;
}

export interface MissingItem {
  description: string;
  codeSection: string;
  remedialAction: string;
  confidenceScore: number;
  severity: "critical" | "major" | "minor";
}

export interface ReviewResult {
  summary: string;
  missingPlans: MissingItem[];
  missingPermits: MissingItem[];
  missingDocumentation: MissingItem[];
  missingInspectionCertificates: MissingItem[];
  criticalFindings: ReviewFinding[];
  majorFindings: ReviewFinding[];
  minorFindings: ReviewFinding[];
  totalFindings: number;
  isCompliant: boolean;
  cityPlannerEmailBody: string;
  submitterEmailBody: string;
}

export interface PlanMetadata {
  chunkId: string;
  drawingTitle: string;
  drawingType: string;
  scale: string;
  keyElements: string[];
  codeReferences: string[];
  rawText: string;
}

async function performWebSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  if (!process.env.SERPAPI_API_KEY) {
    console.error('[OpenAI] SerpAPI key not found in environment variables');
    return [];
  }

  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`SerpAPI request failed with status ${response.status}`);
    }

    const data = await response.json();

    // Extract organic results from SerpAPI response
    const results = data.organic_results?.slice(0, maxResults).map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
    })) ?? [];

    console.log(`[OpenAI] SerpAPI search returned ${results.length} results for query: ${query}`);
    return results;
  } catch (error) {
    console.error('[OpenAI] Error performing web search:', error);
    return [];
  }
}

export async function extractPlanMetadata(
  pdfBase64: string,
  projectDetails: {
    address: string;
    parcelNumber: string;
    city: string;
    county: string;
    projectSummary?: string;
  }
): Promise<PlanMetadata> {
  console.log('[OpenAI] Extracting metadata from plan chunk');

  try {
    // Build the conversation for metadata extraction
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: METADATA_EXTRACTION_PROMPT },
      {
        role: "user",
        content: `
Project Details:
Address: ${projectDetails.address}
Parcel Number: ${projectDetails.parcelNumber}
City: ${projectDetails.city}
County: ${projectDetails.county}
${projectDetails.projectSummary ? `Project Summary: ${projectDetails.projectSummary}` : ''}

[PDF Chunk - Base64 Length: ${pdfBase64.length}]

Please extract key information from this architectural plan chunk. Do not perform compliance review at this stage.`
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 1000,
      stream: false
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content received from OpenAI for metadata extraction');
    }

    try {
      // Preprocess content to remove markdown formatting
      // This handles cases where the model wraps JSON in ```json ... ``` format
      let processedContent = content;

      // Strip out markdown code block delimiters if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        processedContent = jsonMatch[1].trim();
      }

      console.log('[OpenAI] Processing raw response for JSON extraction');
      const metadata = JSON.parse(processedContent) as PlanMetadata;
      console.log('[OpenAI] Successfully extracted metadata from chunk');

      // Generate a unique chunk ID if not provided
      if (!metadata.chunkId) {
        metadata.chunkId = `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }

      return metadata;
    } catch (parseError) {
      console.error('[OpenAI] Failed to parse metadata JSON:', parseError);
      console.error('[OpenAI] Raw content that failed to parse:', content);
      // Return a minimal valid metadata object
      return {
        chunkId: `chunk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        drawingTitle: "Unknown Drawing",
        drawingType: "Unknown",
        scale: "Unknown",
        keyElements: [],
        codeReferences: [],
        rawText: "Error extracting text from PDF"
      };
    }
  } catch (error) {
    console.error('[OpenAI] Error extracting metadata:', error);
    throw error;
  }
}

export async function reviewWithMetadata(
  metadataList: PlanMetadata[],
  projectDetails: {
    address: string;
    parcelNumber: string;
    city: string;
    county: string;
    projectSummary?: string;
  },
  maxRetries: number = 3
): Promise<ReviewResult> {
  console.log('[OpenAI] Starting review with consolidated metadata');
  console.log('[OpenAI] Number of metadata chunks:', metadataList.length);

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      // Format the metadata for better readability in the prompt
      const formattedMetadata = metadataList.map((md, index) => {
        return `
--- PLAN SECTION ${index + 1} ---
Drawing Title: ${md.drawingTitle || "Not specified"}
Drawing Type: ${md.drawingType || "Not specified"}
Scale: ${md.scale || "Not specified"}
Key Elements: ${md.keyElements?.join(", ") || "None specified"}
Code References: ${md.codeReferences?.join(", ") || "None specified"}
Raw Text: ${md.rawText || "No text extracted"}
`;
      }).join("\n\n");

      // Build the initial conversation
      const baseMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: CONSOLIDATED_REVIEW_PROMPT },
        {
          role: "user",
          content: `
Project Details:
Address: ${projectDetails.address}
Parcel Number: ${projectDetails.parcelNumber}
City: ${projectDetails.city}
County: ${projectDetails.county}
${projectDetails.projectSummary ? `Project Summary: ${projectDetails.projectSummary}` : ''}

CONSOLIDATED PLAN METADATA:
${formattedMetadata}

Please analyze the consolidated metadata from these architectural plans and use the web_search tool to find applicable building codes and regulations for this location. Then provide a comprehensive review of compliance.`,
        },
      ];

      const tools: ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current building codes and regulations based on identified municipality. Priority should be given to the identified city first, then county, then the state, then international building codes.",
            parameters: {
              type: "object",
              properties: {
                search_query: {
                  type: "string",
                  description: "The search query to look up building codes and regulations"
                }
              },
              required: ["search_query"]
            }
          }
        }
      ];

      console.log(`[OpenAI] Attempt ${attempts + 1}/${maxRetries}: Sending initial request to OpenAI`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: baseMessages,
        tools,
        tool_choice: "auto",
        max_tokens: 4096,
        stream: false
      });

      console.log('[OpenAI] Received response from OpenAI');
      const message = response.choices[0].message;

      if (!message.tool_calls?.[0]) {
        console.warn('[OpenAI] No web search tool call received in first response');
        throw new Error('No web search tool call received');
      }

      // Process all tool calls
      const toolCalls = message.tool_calls;
      const toolResponses: ChatCompletionMessageParam[] = [];

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'web_search') {
          const args = JSON.parse(toolCall.function.arguments);
          console.log('[OpenAI] Web search query:', args.search_query);

          const searchResults = await performWebSearch(args.search_query, 5);
          console.log('[OpenAI] Web search returned', searchResults.length, 'results');

          toolResponses.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              search_results: searchResults,
              instruction: "Use these search results to determine applicable code sections and identify any violations in the plans. Ensure all findings reference specific code sections from the search results."
            })
          });
        }
      }

      // Request the final analysis
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...baseMessages,
          message,
          ...toolResponses,
          {
            role: "user",
            content: "Please analyze the architectural plans using the building codes and regulations found in the search results. Compare the plan metadata against these codes to identify any compliance issues. Provide a detailed review following the required JSON format. Make sure to include properly formatted HTML email bodies for both city planner and submitter with all required sections."
          }
        ],
        stream: false,
        max_tokens: 4096
      });

      const fullResponse = finalResponse.choices[0].message.content;
      if (!fullResponse) {
        throw new Error('No response content received from OpenAI');
      }

      console.log('[OpenAI] Raw response length:', fullResponse.length);

      try {
        // Preprocess content to remove markdown formatting
        let processedContent = fullResponse;

        // Strip out markdown code block delimiters if present
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          processedContent = jsonMatch[1].trim();
        }

        console.log('[OpenAI] Processing raw response for JSON extraction');
        const result = JSON.parse(processedContent);
        console.log('[OpenAI] Successfully parsed JSON response for consolidated review');

        // Enhanced validation of the response structure
        if (!result.summary || !Array.isArray(result.criticalFindings) ||
          !Array.isArray(result.majorFindings) || !Array.isArray(result.minorFindings) ||
          typeof result.totalFindings !== 'number' || typeof result.isCompliant !== 'boolean' ||
          !result.cityPlannerEmailBody || !result.submitterEmailBody) {
          throw new Error('Invalid response structure from AI');
        }

        // Check for required email formatting elements
        const validateEmail = (emailBody: string, isSubmitter: boolean) => {
          const requiredElements = [
            '<div style="', // Header styling
            '<hr>', // Horizontal line
            '<h3', // Section headings
            'Application Cover Page', // New requirement
            'Review Summary',
            'Finding Counts',
            'Detailed Findings',
            'Missing Items', // New requirement
            'Counts',
            'Findings:',
          ];

          if (isSubmitter) {
            requiredElements.push('Next Steps');
            requiredElements.push('<ol>'); // Ordered list for next steps
          }

          const missingElements = requiredElements.filter(element => !emailBody.includes(element));
          return missingElements.length === 0;
        };

        const plannerEmailValid = validateEmail(result.cityPlannerEmailBody, false);
        const submitterEmailValid = validateEmail(result.submitterEmailBody, true);

        if (!plannerEmailValid || !submitterEmailValid) {
          console.warn('[OpenAI] Email bodies missing required formatting elements');
          if (attempts === maxRetries - 1) {
            // On last attempt, try to fix the email formatting
            console.log('[OpenAI] Attempting to fix email formatting on final attempt');
            result.cityPlannerEmailBody = ensureEmailFormatting(result.cityPlannerEmailBody, result, false);
            result.submitterEmailBody = ensureEmailFormatting(result.submitterEmailBody, result, true);
          } else {
            throw new Error('Email bodies missing required formatting elements');
          }
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
        console.error(`[OpenAI] Attempt ${attempts + 1} failed to parse JSON:`, parseError);
        console.error('[OpenAI] Raw response that failed to parse:', fullResponse);
        lastError = parseError instanceof Error ? parseError : new Error('Failed to parse AI response as JSON');

        if (attempts === maxRetries - 1) {
          return getDefaultErrorResponse();
        }
      }
    } catch (error) {
      console.error(`[OpenAI] Attempt ${attempts + 1} failed with error:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');

      if (attempts === maxRetries - 1) {
        return getDefaultErrorResponse();
      }
    }

    attempts++;
    if (attempts < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  throw lastError || new Error('Failed to process plan after all retry attempts');
}

/**
 * @deprecated Use reviewPlanWithResponsesAPI instead which uses OpenAI's Responses API
 * This function will be removed in a future release
 */
export async function reviewArchitecturalPlan(
  pdfBase64: string,
  projectDetails: {
    address: string;
    parcelNumber: string;
    city: string;
    county: string;
    projectSummary?: string;
  },
  maxRetries: number = 3
): Promise<ReviewResult> {
  console.log('[OpenAI] Starting architectural plan review');
  console.log('[OpenAI] Base64 length:', pdfBase64.length);

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      // Build the initial conversation with structured project details
      const baseMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: COMPLIANCE_REVIEW_PROMPT },
        {
          role: "user",
          content: `
Project Details:
Address: ${projectDetails.address}
Parcel Number: ${projectDetails.parcelNumber}
City: ${projectDetails.city}
County: ${projectDetails.county}
${projectDetails.projectSummary ? `Project Summary: ${projectDetails.projectSummary}` : ''}

[Complete Architectural Plan Set - Base64 Length: ${pdfBase64.length}]

Please analyze the complete set of architectural plans and use the web_search tool to find applicable building codes and regulations for this location. The plans have been combined into a single input for comprehensive review.`,
        },
      ];

      const tools: ChatCompletionTool[] = [
        {
          type: "function",
          function: {
            name: "web_search",
            description: "Search the web for current building codes and regulations based on identified municipality. Priority should be given to the identified city first, then county, then the state, then international building codes.",
            parameters: {
              type: "object",
              properties: {
                search_query: {
                  type: "string",
                  description: "The search query to look up building codes and regulations"
                }
              },
              required: ["search_query"]
            }
          }
        }
      ];

      console.log(`[OpenAI] Attempt ${attempts + 1}/${maxRetries}: Sending initial request to OpenAI`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: baseMessages,
        tools,
        tool_choice: "auto",
        max_tokens: 4096,
        stream: false
      });

      console.log('[OpenAI] Received response from OpenAI');
      const message = response.choices[0].message;

      if (!message.tool_calls?.[0]) {
        console.warn('[OpenAI] No web search tool call received in first response');
        throw new Error('No web search tool call received');
      }

      // Process all tool calls
      const toolCalls = message.tool_calls;
      const toolResponses: ChatCompletionMessageParam[] = [];

      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'web_search') {
          const args = JSON.parse(toolCall.function.arguments);
          console.log('[OpenAI] Web search query:', args.search_query);

          const searchResults = await performWebSearch(args.search_query, 5);
          console.log('[OpenAI] Web search returned', searchResults.length, 'results');

          toolResponses.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              search_results: searchResults,
              instruction: "Use these search results to determine applicable code sections and identify any violations in the plans. Ensure all findings reference specific code sections from the search results."
            })
          });
        }
      }

      // Create a streaming response for the final analysis
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          ...baseMessages,
          message,
          ...toolResponses,
          {
            role: "user",
            content: "Please analyze the architectural plans using the building codes and regulations found in the search results. Compare the plans against these codes to identify any compliance issues. Provide a detailed review following the required JSON format. Make sure to include properly formatted HTML email bodies for both city planner and submitter with all required sections."
          }
        ],
        stream: false,
        max_tokens: 4096
      });

      const fullResponse = stream.choices[0].message.content;
      if (!fullResponse) {
        throw new Error('No response content received from OpenAI');
      }

      console.log('[OpenAI] Raw response length:', fullResponse.length);

      try {
        // Preprocess content to remove markdown formatting
        let processedContent = fullResponse;

        // Strip out markdown code block delimiters if present
        const jsonMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          processedContent = jsonMatch[1].trim();
        }

        console.log('[OpenAI] Processing raw response for JSON extraction');
        const result = JSON.parse(processedContent);
        console.log('[OpenAI] Successfully parsed JSON response');

        // Enhanced validation of the response structure
        if (!result.summary || !Array.isArray(result.criticalFindings) ||
          !Array.isArray(result.majorFindings) || !Array.isArray(result.minorFindings) ||
          typeof result.totalFindings !== 'number' || typeof result.isCompliant !== 'boolean' ||
          !result.cityPlannerEmailBody || !result.submitterEmailBody) {
          throw new Error('Invalid response structure from AI');
        }

        // Check for required email formatting elements
        const validateEmail = (emailBody: string, isSubmitter: boolean) => {
          const requiredElements = [
            '<div style="', // Header styling
            '<hr>', // Horizontal line
            '<h3', // Section headings
            'Application Cover Page', // New requirement
            'Review Summary',
            'Finding Counts',
            'Detailed Findings',
            'Missing Items', // New requirement
            'Counts',
            'Findings:',
          ];

          if (isSubmitter) {
            requiredElements.push('Next Steps');
            requiredElements.push('<ol>'); // Ordered list for next steps
          }

          const missingElements = requiredElements.filter(element => !emailBody.includes(element));
          return missingElements.length === 0;
        };

        const plannerEmailValid = validateEmail(result.cityPlannerEmailBody, false);
        const submitterEmailValid = validateEmail(result.submitterEmailBody, true);

        if (!plannerEmailValid || !submitterEmailValid) {
          console.warn('[OpenAI] Email bodies missing required formatting elements');
          if (attempts === maxRetries - 1) {
            // On last attempt, try to fix the email formatting
            console.log('[OpenAI] Attempting to fix email formatting on final attempt');
            result.cityPlannerEmailBody = ensureEmailFormatting(result.cityPlannerEmailBody, result, false);
            result.submitterEmailBody = ensureEmailFormatting(result.submitterEmailBody, result, true);
          } else {
            throw new Error('Email bodies missing required formatting elements');
          }
        }

        // Validate findings consistency
        if (!result.isCompliant && result.totalFindings === 0) {
          console.warn('[OpenAI] Inconsistent response: isCompliant=false but totalFindings=0');
        }

        // Validate that findings reference code sections
        const allFindings = [...result.criticalFindings, ...result.majorFindings, ...result.minorFindings];
        const findingsWithoutCodeSections = allFindings.filter(f => !f.codeSection);
        if (findingsWithoutCodeSections.length > 0) {
          console.warn('[OpenAI] Found findings without code section references:', findingsWithoutCodeSections.length);
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
        console.error(`[OpenAI] Attempt ${attempts + 1} failed to parse JSON:`, parseError);
        console.error('[OpenAI] Raw response that failed to parse:', fullResponse);
        lastError = parseError instanceof Error ? parseError : new Error('Failed to parse AI response as JSON');

        if (attempts === maxRetries - 1) {
          return getDefaultErrorResponse();
        }
      }
    } catch (error) {
      console.error(`[OpenAI] Attempt ${attempts + 1} failed with error:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');

      if (attempts === maxRetries - 1) {
        return getDefaultErrorResponse();
      }
    }

    attempts++;
    if (attempts < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }

  throw lastError || new Error('Failed to process plan after all retry attempts');
}

// Helper function to fix email formatting if needed
function ensureEmailFormatting(
  emailBody: string,
  result: {
    summary: string;
    missingPlans: MissingItem[];
    missingPermits: MissingItem[];
    missingDocumentation: MissingItem[];
    missingInspectionCertificates: MissingItem[];
    criticalFindings: ReviewFinding[];
    majorFindings: ReviewFinding[];
    minorFindings: ReviewFinding[];
    totalFindings: number;
    isCompliant: boolean;
  },
  isSubmitter: boolean
): string {
  // If email body is already well-formatted, return it as is
  if (emailBody.includes('<div style="') &&
    emailBody.includes('<hr>') &&
    emailBody.includes('Review Summary')) {
    return emailBody;
  }

  // Otherwise, generate a properly formatted email
  const headerColor = result.isCompliant ? '#0066cc' : '#cc0000';
  const headerText = result.isCompliant ? 'Plan Review Complete - Compliant with Building Codes' : 'Plan Review Complete - Action Required';
  const recipient = isSubmitter ? 'Plan Submitter' : 'City Planner';
  const introText = isSubmitter
    ? `We have completed the review of your architectural plans. ${result.isCompliant ? 'Your plans are compliant with all applicable building codes.' : 'Your plans require some modifications before they can be approved.'}`
    : `We have completed the review of the architectural plans. ${result.isCompliant ? 'The plans are compliant with all applicable building codes.' : 'The plans require some modifications before they can be approved.'}`;

  // Build findings section
  let findingsHtml = '';

  if (result.criticalFindings.length > 0 && (isSubmitter || !result.isCompliant)) {
    findingsHtml += `<h4>Critical Findings</h4>`;
    result.criticalFindings.forEach((finding, idx) => {
      findingsHtml += `
      <div>
        <p><strong>${idx + 1}. ${finding.description}</strong></p>
        <p>Code Section: ${finding.codeSection}</p>
        <p>Confidence: ${Math.round(finding.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${finding.remedialAction}</p>
      </div>`;
    });
  }

  if (result.majorFindings.length > 0 && (isSubmitter || !result.isCompliant)) {
    findingsHtml += `<h4>Major Findings</h4>`;
    result.majorFindings.forEach((finding, idx) => {
      findingsHtml += `
      <div>
        <p><strong>${idx + 1}. ${finding.description}</strong></p>
        <p>Code Section: ${finding.codeSection}</p>
        <p>Confidence: ${Math.round(finding.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${finding.remedialAction}</p>
      </div>`;
    });
  }

  if (result.minorFindings.length > 0) {
    findingsHtml += `<h4>Minor Findings</h4>`;
    result.minorFindings.forEach((finding, idx) => {
      findingsHtml += `
      <div>
        <p><strong>${idx + 1}. ${finding.description}</strong></p>
        <p>Code Section: ${finding.codeSection}</p>
        <p>Confidence: ${Math.round(finding.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${finding.remedialAction}</p>
      </div>`;
    });
  }

  // Build missing items section
  let missingItemsHtml = '';

  if (result.missingPlans.length > 0) {
    missingItemsHtml += `<h4>Missing Plans</h4>`;
    result.missingPlans.forEach((item, idx) => {
      missingItemsHtml += `
      <div>
        <p><strong>${idx + 1}. ${item.description}</strong></p>
        <p>Code Section: ${item.codeSection}</p>
        <p>Confidence: ${Math.round(item.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${item.remedialAction}</p>
      </div>`;
    });
  }

  if (result.missingPermits.length > 0) {
    missingItemsHtml += `<h4>Missing Permits & Applications</h4>`;
    result.missingPermits.forEach((item, idx) => {
      missingItemsHtml += `
      <div>
        <p><strong>${idx + 1}. ${item.description}</strong></p>
        <p>Code Section: ${item.codeSection}</p>
        <p>Confidence: ${Math.round(item.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${item.remedialAction}</p>
      </div>`;
    });
  }

  if (result.missingDocumentation.length > 0) {
    missingItemsHtml += `<h4>Missing Documentation</h4>`;
    result.missingDocumentation.forEach((item, idx) => {
      missingItemsHtml += `
      <div>
        <p><strong>${idx + 1}. ${item.description}</strong></p>
        <p>Code Section: ${item.codeSection}</p>
        <p>Confidence: ${Math.round(item.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${item.remedialAction}</p>
      </div>`;
    });
  }

  if (result.missingInspectionCertificates.length > 0) {
    missingItemsHtml += `<h4>Missing Inspection Certificates</h4>`;
    result.missingInspectionCertificates.forEach((item, idx) => {
      missingItemsHtml += `
      <div>
        <p><strong>${idx + 1}. ${item.description}</strong></p>
        <p>Code Section: ${item.codeSection}</p>
        <p>Confidence: ${Math.round(item.confidenceScore * 100)}%</p>
        <p>Remedial Action: ${item.remedialAction}</p>
      </div>`;
    });
  }

  // Add Next Steps section for submitter
  const nextStepsHtml = isSubmitter && !result.isCompliant ? `
  <h3>Next Steps</h3>
  <ol>
    <li>Review all findings in detail</li>
    <li>Make the necessary corrections to your plans</li>
    <li>Resubmit your corrected plans through our system</li>
  </ol>` : '';

  // Build the footer
  const footerText = result.isCompliant
    ? "This email was automatically generated by CivicStream. The attached plan has been reviewed by AI and meets the requirements for direct submission to city planning."
    : "This email was automatically generated by CivicStream. The attached plan has been reviewed by AI and does not meet the requirements for direct submission to city planning.";

  // Combine all parts into a properly formatted email
  return `
<div style="color: ${headerColor}; font-size: 24px; font-weight: bold;">${headerText}</div>
<hr>
<h3>Application Cover Page</h3>
<p><strong>Project Address:</strong> [ADDRESS]</p>
<p><strong>Use:</strong> [PROJECT TYPE]</p>
<p><strong>Zoning:</strong> [ZONING]</p>
<p><strong>Submitted Files:</strong> [FILE LIST]</p>
<p>Dear ${recipient},</p>
<p>${introText}</p>
<h3 style="color: #2e8b57;">Review Summary</h3>
<p>${result.summary}</p>
<div style="background-color: #e6f3ff; padding: 15px; border-radius: 5px;">
  <h4 style="color: #0066cc; margin-top: 0;">Finding Counts</h4>
  <ul>
    <li>Critical Findings: ${result.criticalFindings.length}</li>
    <li>Major Findings: ${result.majorFindings.length}</li>
    <li>Minor Findings: ${result.minorFindings.length}</li>
    <li>Total Findings: ${result.totalFindings}</li>
  </ul>
  <ul>
    <li>Missing Plans: ${result.missingPlans.length}</li>
    <li>Missing Permits: ${result.missingPermits.length}</li>
    <li>Missing Documentation: ${result.missingDocumentation.length}</li>
    <li>Missing Inspection Certificates: ${result.missingInspectionCertificates.length}</li>
  </ul>
</div>
<h3>Detailed Findings</h3>
<div style="margin-left: 20px;">
  ${findingsHtml}
</div>
<h3>Missing Items</h3>
<div style="margin-left: 20px;">
  ${missingItemsHtml}
</div>
${nextStepsHtml}
<div style="font-size: 12px; color: #666; margin-top: 20px;">
  ${footerText}
</div>`;
}

function getDefaultErrorResponse(): ReviewResult {
  // For testing purposes, provide a valid but minimal response
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

/**
 * Uses OpenAI's Responses API to review architectural plans
 * This is a prototype implementation that provides the same functionality as reviewArchitecturalPlan
 * but uses the newer Responses API for file handling and web search
 */
export async function reviewPlanWithResponsesAPI(
  pdfBuffer: Buffer,
  pdfFileName: string,
  projectDetails: {
    address: string;
    parcelNumber: string;
    city: string;
    county: string;
    projectSummary?: string;
  },
  maxRetries: number = 3
): Promise<ReviewResult> {
  console.log('[ResponsesAPI] Starting architectural plan review');
  console.log('[ResponsesAPI] PDF Buffer size:', pdfBuffer.length);

  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      // Create a Blob from the buffer for file upload
      const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const file = new File([blob], pdfFileName, { type: 'application/pdf' });

      // First, upload the file to OpenAI
      console.log(`[ResponsesAPI] Attempt ${attempts + 1}/${maxRetries}: Uploading PDF to OpenAI`);
      const fileUpload = await openai.files.create({
        file,
        purpose: "assistants"
      });

      console.log('[ResponsesAPI] File uploaded with ID:', fileUpload.id);

      // Create a vector store with the file
      console.log('[ResponsesAPI] Creating vector store with file');
      const vectorStore = await openai.vectorStores.create({
        name: "Plan Review Documents",
        file_ids: [fileUpload.id]
      });

      console.log('[ResponsesAPI] Vector store created with ID:', vectorStore.id);

      // Build the system prompt
      const systemPrompt = COMPLIANCE_REVIEW_PROMPT.replace(
        "BEFORE analyzing the plans, you MUST use the web_search function to retrieve the latest building codes and regulations.",
        "BEFORE analyzing the plans, you MUST use web search to retrieve the latest building codes and regulations."
      );

      // Create a message with project details and instructions
      const userMessage = `
Project Details:
Address: ${projectDetails.address}
Parcel Number: ${projectDetails.parcelNumber}
City: ${projectDetails.city}
County: ${projectDetails.county}
${projectDetails.projectSummary ? `Project Summary: ${projectDetails.projectSummary}` : ''}

I've attached a complete set of architectural plans as a PDF. Please analyze them and:

1. First, search the web for the most current building codes and regulations for ${projectDetails.city}, ${projectDetails.county}.
2. Review the plans against these codes.
3. Provide a detailed compliance review in the required JSON format.
4. Include properly formatted HTML email bodies for both city planner and submitter.

Make sure to follow exactly the same format as specified in your instructions.`;

      // Call the OpenAI Responses API via fetch - first to perform search
      console.log('[ResponsesAPI] Calling OpenAI Responses API for search phase');
      const searchPhaseRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: [
            { type: 'message', role: 'system', content: systemPrompt },
            { type: 'message', role: 'user', content: userMessage + '\n\nPlease use the file search tool to analyze the uploaded PDF.' }
          ],
          tools: [
            {
              type: 'file_search',
              vector_store_ids: [vectorStore.id]
            },
            {
              type: 'web_search'
            }
          ],
          tool_choice: 'auto'
        })
      });

      if (!searchPhaseRes.ok) {
        const errText = await searchPhaseRes.text();
        throw new Error(`[ResponsesAPI] HTTP ${searchPhaseRes.status}: ${errText}`);
      }

      const searchPhaseData = await searchPhaseRes.json();
      console.log('[ResponsesAPI] Search phase response received');

      // Extract and format any search results from the first phase
      const searchResults = [];
      if (searchPhaseData.output && Array.isArray(searchPhaseData.output)) {
        for (const item of searchPhaseData.output) {
          if (item.type === 'file_search_call' && item.result && item.result.file_chunks) {
            const chunks = item.result.file_chunks.map((chunk: any) => {
              return `File: ${chunk.file_id}\nPage ${chunk.page_number || 'unknown'}: ${chunk.text || 'No text found'}`;
            }).join('\n\n');
            searchResults.push(`Search Results:\n${chunks}`);
          }
          if (item.type === 'web_search_call' && item.result && item.result.web_search_results) {
            const webResults = item.result.web_search_results.map((result: any) => {
              return `URL: ${result.url || 'No URL'}\nTitle: ${result.title || 'No title'}\nSnippet: ${result.snippet || 'No snippet'}`;
            }).join('\n\n');
            searchResults.push(`Web Search Results:\n${webResults}`);
          }
        }
      }

      // Now that we've performed the file search, ask for a final analysis to get a text output
      console.log('[ResponsesAPI] Calling OpenAI Responses API for final analysis');
      const responsesApiRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          input: [
            { type: 'message', role: 'system', content: systemPrompt },
            { type: 'message', role: 'user', content: userMessage + '\n\nPlease use the file search tool to analyze the uploaded PDF.' },
            {
              type: 'message',
              role: 'assistant',
              content: "I've searched through the architectural plans and found the following information:" +
                (searchResults.length > 0 ? '\n\n' + searchResults.join('\n\n') : "\n\nI wasn't able to extract much information from the plans.")
            },
            {
              type: 'message',
              role: 'user',
              content: "Now that you've analyzed the plans, please provide your full review in the required JSON format with all findings and properly formatted HTML email bodies. Make sure to follow the exact format specified in your instructions."
            }
          ],
          tools: [], // No tools for final analysis phase
          tool_choice: 'none'
        })
      });

      // Delete the resources after use
      try {
        // Delete the vector store
        try {
          await openai.vectorStores.del(vectorStore.id);
          console.log('[ResponsesAPI] Vector store deleted from OpenAI');
        } catch (vectorStoreDeleteError) {
          console.warn('[ResponsesAPI] Warning: Failed to delete vector store from OpenAI:', vectorStoreDeleteError);
        }

        // Delete the uploaded file
        await openai.files.del(fileUpload.id);
        console.log('[ResponsesAPI] File deleted from OpenAI');
      } catch (deleteError) {
        console.warn('[ResponsesAPI] Warning: Failed to delete file from OpenAI:', deleteError);
      }

      if (!responsesApiRes.ok) {
        const errText = await responsesApiRes.text();
        throw new Error(`[ResponsesAPI] HTTP ${responsesApiRes.status}: ${errText}`);
      }

      const responsesApiData = await responsesApiRes.json();
      console.log('[ResponsesAPI] Raw API response:', JSON.stringify(responsesApiData).slice(0, 500));

      // Parse the output array from the Responses API
      const outputArr = responsesApiData.output;
      if (!outputArr || !Array.isArray(outputArr)) {
        throw new Error('No output array received from OpenAI Responses API');
      }

      console.log('[ResponsesAPI] Output types in response:', outputArr.map((item: any) => item.type).join(', '));
      console.log('[ResponsesAPI] First output item structure:', JSON.stringify(outputArr[0] || {}).substring(0, 200));

      let processedContent = '';

      // First try for direct text output
      const textOutput = outputArr.find((item: any) => item.type === 'text');
      if (textOutput && textOutput.text) {
        console.log('[ResponsesAPI] Found text output, using that');
        processedContent = textOutput.text;
      }
      // Next try for message with content array that contains text
      else {
        const messageOutput = outputArr.find((item: any) =>
          item.type === 'message' && item.content && Array.isArray(item.content)
        );

        if (messageOutput && messageOutput.content) {
          console.log('[ResponsesAPI] Found message with content array, length:', messageOutput.content.length);

          // Look for text content in the message's content array
          for (const contentItem of messageOutput.content) {
            if (contentItem.type === 'text' || contentItem.type === 'output_text') {
              console.log('[ResponsesAPI] Found text in message content');
              processedContent = contentItem.text;
              break;
            }
          }
        }

        // Final fallback for legacy message format
        if (!processedContent) {
          const legacyMessageOutput = outputArr.find((item: any) =>
            item.type === 'message' && item.message && item.message.content
          );

          if (legacyMessageOutput && legacyMessageOutput.message && legacyMessageOutput.message.content) {
            console.log('[ResponsesAPI] Found legacy message content');
            processedContent = legacyMessageOutput.message.content;
          }
        }

        // If we still don't have content, return the default response
        if (!processedContent) {
          console.error('[ResponsesAPI] No usable text content found in response');
          return getDefaultErrorResponse();
        }
      }
      // Strip out markdown code block delimiters if present
      const jsonMatch = processedContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        processedContent = jsonMatch[1].trim();
      } else {
        // Try to find a JSON object anywhere in the text
        const potentialJsonMatch = processedContent.match(/(\{[\s\S]*\})/);
        if (potentialJsonMatch && potentialJsonMatch[1]) {
          console.log('[ResponsesAPI] No code block found, but potential JSON detected');
          processedContent = potentialJsonMatch[1].trim();
        }
      }

      console.log('[ResponsesAPI] Attempting to parse JSON from content of length:', processedContent.length);

      // Fall back to default response if parsing fails
      let result;
      try {
        result = JSON.parse(processedContent);
        console.log('[ResponsesAPI] Successfully parsed JSON result');
      } catch (parseError) {
        console.error('[ResponsesAPI] Failed to parse JSON:', parseError);
        console.log('[ResponsesAPI] JSON parsing failed, returning default response');
        return getDefaultErrorResponse();
      }

      // Validate structure and use default response as fallback
      if (!result.summary || !Array.isArray(result.criticalFindings) ||
        !Array.isArray(result.majorFindings) || !Array.isArray(result.minorFindings) ||
        typeof result.totalFindings !== 'number' || typeof result.isCompliant !== 'boolean' ||
        !result.cityPlannerEmailBody || !result.submitterEmailBody) {
        console.error('[ResponsesAPI] Invalid response structure from AI');
        return getDefaultErrorResponse();
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
    } catch (error) {
      console.error(`[ResponsesAPI] Attempt ${attempts + 1} failed with error:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      if (attempts === maxRetries - 1) {
        return getDefaultErrorResponse();
      }
    }
    attempts++;
    if (attempts < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
  throw lastError || new Error('Failed to process plan after all retry attempts');
}