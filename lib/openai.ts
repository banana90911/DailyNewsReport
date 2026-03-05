import OpenAI from "openai";
import { getRequiredEnv } from "@/lib/env";

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: getRequiredEnv("OPENAI_API_KEY") });
  }
  return cachedClient;
}

export async function generateText(params: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    temperature: params.temperature ?? 0.4,
    max_tokens: params.maxTokens,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user }
    ]
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("LLM 응답이 비어 있습니다.");
  }

  return content.trim();
}
