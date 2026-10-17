import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

// const apiKey = process.env.OPENAI_API_KEY;
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured.");
}

// const openai = new OpenAI({
//   apiKey,
// });

const model = process.env.OPENROUTER_MODEL;

const openrouter = new OpenAI({
  apiKey: apiKey || "missing-api-key",
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "",
    "X-Title": "ProfitLens AI",
  },
});

export interface AIRecommendation {
  summary: string;
  recommendations: string[];
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface AlertForExplanation {
  productName: string;
  issueType:
    | "LOW_MARGIN"
    | "SLOW_MOVING_INVENTORY"
    | "HIGH_COST"
    | "EXPENSE_SPIKE"
    | "SALES_DECLINE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  evidence: {
    metric: string;
    actualValue: number;
    threshold: number;
    unit: string;
  };
  suggestedAction: string;
}

export interface AIExplanation {
  title: string;
  explanation: string;
  possibleCauses: string[];
  businessImpact: string;
  recommendedActions: string[];
  disclaimer: string;
}

export const generateAIExplanation = async (
  alert: AlertForExplanation[],
): Promise<AIExplanation> => {
  const response = await openrouter.chat.completions.create({
    model: model!,
    messages: [
      {
        role: "system",
        content: `
You are a business analytics assistant.

Explain business alerts in clear, simple English.

Rules:
- Use only the supplied data for factual claims.
- Never invent sales, costs, or financial figures.
- Distinguish possible causes from confirmed facts.
- Do not change the supplied calculations.
- Provide practical, cautious recommendations.
- Return valid JSON only.
        `.trim(),
      },
      {
        role: "user",
        content: JSON.stringify(alert),
      },
    ],
    response_format: {
      type: "json_object",
    },
    temperature: 0.2,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI returned an empty response.");
  }

  const parsed: unknown = JSON.parse(content);

  // Production code should validate the response
  // with a schema such as Zod before returning it.
  return parsed as AIExplanation;
};
