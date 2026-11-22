import { readDotenvValue } from "../env";
import { createAnthropicLlm } from "./anthropic";
import { createGeminiLlm } from "./gemini";
import type { StructuredLlm } from "./types";

export type LlmSelection = { llm: StructuredLlm } | { llm: null; reason: string };

/**
 * .env의 AI_PROVIDER로 공급자를 고른다(기본값 gemini).
 * - gemini: GEMINI_API_KEY와 GEMINI_MODEL이 모두 있어야 한다(모델 이름은 코드에 두지 않는다)
 * - anthropic: ANTHROPIC_API_KEY
 * 없으면 llm: null → 호출하는 쪽이 데모 모드로 대체한다.
 */
export function selectLlm(envDir: string): LlmSelection {
  const provider = (readDotenvValue(envDir, "AI_PROVIDER") ?? "gemini").toLowerCase();
  if (provider === "anthropic") {
    const key = readDotenvValue(envDir, "ANTHROPIC_API_KEY");
    return key ? { llm: createAnthropicLlm(key) } : { llm: null, reason: "ANTHROPIC_API_KEY가 없어요" };
  }
  if (provider !== "gemini") return { llm: null, reason: `AI_PROVIDER 값(${provider})을 알 수 없어요. gemini 또는 anthropic` };
  const key = readDotenvValue(envDir, "GEMINI_API_KEY");
  const model = readDotenvValue(envDir, "GEMINI_MODEL");
  if (!key) return { llm: null, reason: "GEMINI_API_KEY가 없어요" };
  if (!model) return { llm: null, reason: "GEMINI_MODEL이 없어요(.env.example 참고)" };
  return { llm: createGeminiLlm(key, model) };
}

export { AiServiceError } from "./types";
export type { StructuredLlm } from "./types";
