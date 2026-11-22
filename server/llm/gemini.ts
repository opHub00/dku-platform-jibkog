import { AiServiceError, type JsonSchema, type StructuredLlm, type StructuredRequest } from "./types";

/**
 * Google Gemini API (REST generateContent). SDK 없이 fetch로 호출한다.
 * - JSON 강제: generationConfig.responseMimeType = "application/json" + responseJsonSchema(JSON Schema)
 * - 파일: contents.parts[].inlineData { mimeType, data(base64) }
 * - 인증: x-goog-api-key 헤더(키를 URL에 넣지 않는다)
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 90_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Gemini가 지원하지 않을 수 있는 키워드(additionalProperties)는 빼고 보낸다. 검증은 서버 parse 함수가 한다. */
export function toGeminiSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: schema.type };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = [...schema.enum];
  if (schema.required) out.required = [...schema.required];
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]));
  }
  return out;
}

export function buildGeminiBody(request: StructuredRequest): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: request.system }] },
    contents: [
      {
        role: "user",
        parts: request.parts.map((part) =>
          part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.mimeType, data: part.data } },
        ),
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiSchema(request.schema),
    },
  };
}

/** generateContent 응답에서 JSON 텍스트를 꺼내 파싱한다. 형식이 틀리면 AiServiceError */
export function parseGeminiResponse(json: unknown): unknown {
  if (!isRecord(json)) throw new AiServiceError("Gemini 응답 형식 오류", 502, "format");
  const feedback = json.promptFeedback;
  if (isRecord(feedback) && typeof feedback.blockReason === "string" && feedback.blockReason !== "BLOCK_REASON_UNSPECIFIED") {
    throw new AiServiceError(`Gemini가 요청을 차단했어요(${feedback.blockReason})`, 502, "blocked");
  }
  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  const first: unknown = candidates[0];
  if (!isRecord(first)) throw new AiServiceError("Gemini가 답을 주지 않았어요", 502, "format");
  const finish = first.finishReason;
  if (finish !== undefined && finish !== "STOP") {
    const reason = finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST" ? "blocked" : "format";
    throw new AiServiceError(`Gemini 응답이 끝나지 않았어요(${String(finish)})`, 502, reason);
  }
  const content = first.content;
  const parts = isRecord(content) && Array.isArray(content.parts) ? content.parts : [];
  const text = parts
    .filter((part): part is Record<string, unknown> => isRecord(part) && typeof part.text === "string" && part.thought !== true)
    .map((part) => String(part.text))
    .join("")
    .trim()
    // JSON 모드에서도 혹시 코드 블록으로 감싸 오면 벗긴다
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  if (text === "") throw new AiServiceError("Gemini 응답이 비어 있어요", 502, "format");
  try {
    return JSON.parse(text);
  } catch {
    throw new AiServiceError("Gemini가 JSON 형식을 지키지 않았어요", 502, "format");
  }
}

function errorFromStatus(status: number, body: string): AiServiceError {
  if (status === 429) return new AiServiceError("Gemini 무료 한도를 넘었어요(429 RESOURCE_EXHAUSTED)", 429, "rate_limit");
  if (status === 401 || status === 403) return new AiServiceError("Gemini 키가 올바르지 않거나 권한이 없어요", 503, "auth");
  if (status === 400) return new AiServiceError(`Gemini 요청 형식 오류: ${body.slice(0, 300)}`, 400, "bad_request");
  if (status === 404) return new AiServiceError("GEMINI_MODEL에 적은 모델을 찾을 수 없어요", 503, "bad_request");
  return new AiServiceError(`Gemini 서버 오류(${status})`, 502, "upstream");
}

export function createGeminiLlm(apiKey: string, model: string): StructuredLlm {
  return {
    info: { provider: "gemini", model },
    async generateJson(request) {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(buildGeminiBody(request)),
          signal: request.signal ? AbortSignal.any([request.signal, timeout]) : timeout,
        });
      } catch (error) {
        if (request.signal?.aborted) throw error;
        throw new AiServiceError("Gemini에 연결하지 못했어요", 502, "upstream");
      }
      if (!response.ok) throw errorFromStatus(response.status, await response.text().catch(() => ""));
      return parseGeminiResponse(await response.json());
    },
  };
}
