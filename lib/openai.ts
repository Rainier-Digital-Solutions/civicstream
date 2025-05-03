import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// The compliance review prompt
const COMPLIANCE_REVIEW_PROMPT = `
You are a city plan reviewer for municipalities, focusing on the Greater Seattle Area. Your task is to review architectural plans and provide a structured JSON response.

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any explanatory text before or after the JSON. The response must be parseable by JSON.parse().

Your response will be used to automatically generate emails, so it must follow this exact format:

{
  "summary": "Concise summary of the review and overall compliance.",
  "criticalFindings": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.95, "severity": "critical" }, ... ],
  "majorFindings": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.85, "severity": "major" }, ... ],
  "minorFindings": [ { "description": "...", "codeSection": "...", "remedialAction": "...", "confidenceScore": 0.75, "severity": "minor" }, ... ],
  "totalFindings": 0,
  "isCompliant": true,
  "cityPlannerEmailBody": "<HTML or plain text email body for the city planner>",
  "submitterEmailBody": "<HTML or plain text email body for the submitter>"
}

To perform the review:

1. Use web search capabilities to access and verify the most current international building code, municipal zoning code, and state and local zoning and planning codes as of the submission date.

2. Extract the address and parcel number from uploaded PDF architectural plans to identify the specific municipality and applicable codes, cross-checking the address with the parcel number to ensure accuracy.

3. Analyze the plans, which include a scale, compass, legend, and a general information table, along with accompanying documents (e.g., full plan sets, required inspection certificates, surveys, stormwater management plans, traffic studies).

4. For each finding, provide:
   - A clear description of the issue
   - The specific code section violated (with section numbers and hyperlinks if available)
   - Severity ("critical", "major", or "minor")
   - Confidence score (0.0–1.0)
   - Explicit remedial actions to comply with the code

5. The cityPlannerEmailBody should:
   - Be addressed to a city planner
   - Confirm compliance status
   - List any minor findings
   - Use a professional tone

6. The submitterEmailBody should:
   - Be addressed to the plan submitter
   - List all findings (critical, major, minor)
   - Include a "Next Steps" section with:
     1. Review all findings in detail
     2. Make the necessary corrections to your plans
     3. Resubmit your corrected plans through our system
   - Use a supportive, professional tone

REMEMBER: Your response must be ONLY a valid JSON object. Do not include any other text.
`;

export interface ReviewFinding {
  description: string;
  codeSection: string;
  severity: "critical" | "major" | "minor";
  confidenceScore: number;
  remedialAction: string;
}

export interface ReviewResult {
  summary: string;
  criticalFindings: ReviewFinding[];
  majorFindings: ReviewFinding[];
  minorFindings: ReviewFinding[];
  totalFindings: number;
  isCompliant: boolean;
  cityPlannerEmailBody: string;
  submitterEmailBody: string;
}

// Stub: replace with your real search‐API integration
// TODO: Implement actual web search functionality
async function performWebSearch(query: string, maxResults: number) {
  // e.g. call Bing / Google CSE, return [{ title, snippet, url }, …]
  return [];
}

export async function reviewArchitecturalPlan(
  pdfBase64: string
): Promise<ReviewResult> {
  // Build the initial conversation
  const baseMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: COMPLIANCE_REVIEW_PROMPT },
    {
      role: "user",
      content: `[PDF Content Attached - Base64 Length: ${pdfBase64.length}]`,
    },
  ];

  // Let GPT call our web_search function if it needs live code lookups
  const functions = [
    {
      name: "web_search",
      description:
        "Lookup the latest building code, zoning code, or state/local regulations",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search terms" },
          maxResults: {
            type: "integer",
            description: "Number of top results to return",
          },
        },
        required: ["query"],
      },
    },
  ];

  // 1️⃣ First pass: GPT may request web_search(...)
  const first = await openai.chat.completions.create({
    model: "o4-mini",
    messages: baseMessages,
    functions,
    function_call: "auto",
    max_completion_tokens: 4000,
  });

  let planReviewText: string;

  const msg1 = first.choices[0].message;
  if (msg1.function_call) {
    // 2️⃣ Execute the search
    const { name, arguments: argStr } = msg1.function_call;
    const args = JSON.parse(argStr);
    const results = await performWebSearch(args.query, args.maxResults || 5);

    // 3️⃣ Feed results back
    const second = await openai.chat.completions.create({
      model: "o4-mini",
      messages: [
        ...baseMessages,
        msg1, // the function_call message from the API response
        {
          role: "function", // Ensure role is correctly typed
          name,
          content: JSON.stringify(results),
        },
      ] as ChatCompletionMessageParam[], // Cast to the required type
      max_completion_tokens: 4000,
    });
    planReviewText = second.choices[0].message.content || "";
  } else {
    // no search needed
    planReviewText = msg1.content || "";
  }

  // Log the raw response for debugging
  console.log('Raw OpenAI response:', planReviewText);

  try {
    // Parse the JSON response
    const result = JSON.parse(planReviewText);

    // Validate the response structure
    if (!result.summary || !Array.isArray(result.criticalFindings) ||
      !Array.isArray(result.majorFindings) || !Array.isArray(result.minorFindings) ||
      typeof result.totalFindings !== 'number' || typeof result.isCompliant !== 'boolean' ||
      !result.cityPlannerEmailBody || !result.submitterEmailBody) {
      console.error('Invalid response structure:', result);
      throw new Error('Invalid response structure from AI');
    }

    return {
      summary: result.summary,
      criticalFindings: result.criticalFindings,
      majorFindings: result.majorFindings,
      minorFindings: result.minorFindings,
      totalFindings: result.totalFindings,
      isCompliant: result.isCompliant,
      cityPlannerEmailBody: result.cityPlannerEmailBody,
      submitterEmailBody: result.submitterEmailBody
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    console.error('Raw response that failed to parse:', planReviewText);
    throw new Error('Failed to parse AI response as JSON');
  }
}