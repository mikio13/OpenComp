import type {
  ResearchCompetitorResult,
  ResearchSummary,
} from "@/features/research/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

interface OpenAIOutputText {
  type?: string;
  text?: string;
}

interface OpenAIOutputItem {
  type?: string;
  content?: OpenAIOutputText[];
}

interface OpenAIResponseBody {
  output?: OpenAIOutputItem[];
  output_text?: string;
  error?: {
    message?: string;
  };
}

const researchSummarySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "executiveSummary",
    "competitorFindings",
    "opportunities",
    "stripeActions",
    "stripeImplementation",
  ],
  properties: {
    headline: {
      type: "string",
    },
    executiveSummary: {
      type: "string",
    },
    competitorFindings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "summary", "pricing", "checkout", "friction", "evidence"],
        properties: {
          url: { type: "string" },
          summary: { type: "string" },
          pricing: { type: "string" },
          checkout: { type: "string" },
          friction: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    opportunities: {
      type: "array",
      items: {
        type: "string",
      },
    },
    stripeActions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "apiHint", "risk", "evidence"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          apiHint: { type: "string" },
          risk: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          evidence: { type: "string" },
        },
      },
    },
    stripeImplementation: {
      type: "object",
      additionalProperties: false,
      required: ["codexPrompt", "codeSnippets"],
      properties: {
        codexPrompt: {
          type: "string",
        },
        codeSnippets: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description", "command", "notes"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              command: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

function extractOutputText(response: OpenAIResponseBody): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text")
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

export async function synthesizeResearchSummary({
  results,
  prompt,
  ownWebsite,
}: {
  results: ResearchCompetitorResult[];
  prompt: string;
  ownWebsite: string | null;
}): Promise<ResearchSummary> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      instructions:
        "You are a concise pricing strategist and Stripe implementation planner. Synthesize mystery-shopper observations into actionable pricing and checkout recommendations. Do not invent facts; tie every recommendation to observed evidence. Do not claim to change Stripe directly. Produce a handoff that a user can paste into their own Codex session, plus review-first Stripe API curl snippets using placeholders for product, price, coupon, and lookup keys. Curl snippets must use test-mode-safe placeholders like sk_test_xxx, prod_xxx, price_xxx, coupon_xxx, and lookup_key values; never imply they are ready to run against live Stripe without review. Keep the output compact and useful for a founder or growth lead.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  researchPrompt: prompt,
                  ownWebsite,
                  tinyFishResults: results.map((result) => ({
                    url: result.url,
                    kind: result.kind,
                    label: result.label,
                    observation: result.observation,
                    screenshotUrl: result.screenshotUrl,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "opencomp_research_summary",
          strict: true,
          schema: researchSummarySchema,
        },
      },
    }),
    cache: "no-store",
  });

  const responseBody = (await response.json().catch(() => null)) as
    | OpenAIResponseBody
    | null;

  if (!response.ok) {
    throw new Error(
      responseBody?.error?.message ||
        "OpenAI synthesis request failed before a report could be generated.",
    );
  }

  const outputText = responseBody ? extractOutputText(responseBody) : "";

  if (!outputText) {
    throw new Error("OpenAI returned no synthesis output.");
  }

  try {
    return JSON.parse(outputText) as ResearchSummary;
  } catch {
    throw new Error("OpenAI returned synthesis output that was not valid JSON.");
  }
}
