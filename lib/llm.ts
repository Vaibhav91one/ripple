// Model picker. Returns null when nothing is configured so callers can fall back to the committed cache.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { env as readEnv, PROVIDERS, type Env } from "./env";

export { PROVIDERS };
export type Role = "extract" | "agent";

export function pickModel(role: Role, env: Partial<Pick<Env, "LLM_PROVIDER" | "LLM_API_KEY" | "LLM_BASE_URL" | "MODEL_AGENT" | "MODEL_EXTRACT">> = readEnv()): LanguageModel | null {
  const provider = env.LLM_PROVIDER;
  const modelId = role === "extract" ? env.MODEL_EXTRACT : env.MODEL_AGENT;
  const apiKey = env.LLM_API_KEY;
  const baseURL = env.LLM_BASE_URL || undefined;
  if (!provider || !modelId) return null;
  if (provider !== "ollama" && !apiKey) return null;
  switch (provider) {
    case "anthropic": return createAnthropic({ apiKey, baseURL })(modelId);
    case "openai": return createOpenAI({ apiKey, baseURL })(modelId);
    case "google": return createGoogleGenerativeAI({ apiKey, baseURL })(modelId);
    case "openrouter": return createOpenRouter({ apiKey, baseURL })(modelId);
    case "openai-compatible":
      return baseURL ? createOpenAICompatible({ name: "custom", apiKey, baseURL })(modelId) : null;
    case "ollama": return createOllama({ baseURL })(modelId);
    default: return null;
  }
}
