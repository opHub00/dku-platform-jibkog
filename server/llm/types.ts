import type { AiModelInfo } from "../../client/src/features/presale/ai/types";

/** 공급자와 무관한 JSON 스키마(JSON Schema 부분집합: type, properties, required, items, enum, description) */
export type JsonSchema = {
  type: string | readonly string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  enum?: readonly string[];
  additionalProperties?: boolean;
};

export type LlmPart =
  | { type: "text"; text: string }
  /** PDF·이미지. base64 */
  | { type: "file"; mimeType: string; data: string };

export type StructuredRequest = {
  system: string;
  /** 결과 이름(Anthropic에서는 도구 이름) */
  name: string;
  description: string;
  schema: JsonSchema;
  parts: LlmPart[];
  signal?: AbortSignal;
};

/** 정해진 JSON 형식으로 답을 받는 LLM. 결과 검증은 호출하는 쪽(parse 함수)이 한다. */
export interface StructuredLlm {
  readonly info: AiModelInfo;
  generateJson(request: StructuredRequest): Promise<unknown>;
}

/** 무료 한도 초과(429)인지. 모듈이 여러 번 로드돼도 동작하도록 클래스 대신 reason 값으로 본다. */
export function isRateLimitError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "reason" in error && error.reason === "rate_limit";
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** 무료 한도 초과(429) 등 원인 표시용 */
    readonly reason: "rate_limit" | "auth" | "bad_request" | "blocked" | "upstream" | "format" = "upstream",
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}
