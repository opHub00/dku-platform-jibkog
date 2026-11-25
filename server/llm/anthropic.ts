import Anthropic from "@anthropic-ai/sdk";
import { AiServiceError, type JsonSchema, type StructuredLlm } from "./types";

/**
 * Anthropic Messages API(기존 방식).
 * claude-opus-5-5는 강제 tool_choice(any/tool)를 400으로 거부하므로
 * strict 도구 + tool_choice auto(병렬 호출 끔) + "반드시 도구 호출" 지시로 JSON을 받는다.
 */
const MODEL = "claude-opus-5-5";

function toInputSchema(schema: JsonSchema): Anthropic.Tool.InputSchema {
  const convert = (s: JsonSchema): Record<string, unknown> => {
    const out: Record<string, unknown> = { type: s.type };
    if (s.description) out.description = s.description;
    if (s.enum) out.enum = [...s.enum];
    if (s.required) out.required = [...s.required];
    if (s.items) out.items = convert(s.items);
    if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, convert(v)]));
    if (s.type === "object") out.additionalProperties = false;
    return out;
  };
  return { ...convert(schema), type: "object" };
}

export function createAnthropicLlm(apiKey: string): StructuredLlm {
  // 키는 .env에서 읽어 넘겨준 값만 쓴다(환경변수·프로필 자동 탐색 안 함).
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  return {
    info: { provider: "anthropic", model: MODEL },
    async generateJson(request) {
      const tool: Anthropic.Tool = {
        name: request.name,
        description: request.description,
        strict: true,
        input_schema: toInputSchema(request.schema),
      };
      const content: Anthropic.ContentBlockParam[] = request.parts.map((part): Anthropic.ContentBlockParam => {
        if (part.type === "text") return { type: "text", text: part.text };
        if (part.mimeType === "application/pdf") {
          return { type: "document", source: { type: "base64", media_type: "application/pdf", data: part.data } };
        }
        if (part.mimeType === "image/jpeg" || part.mimeType === "image/png" || part.mimeType === "image/webp" || part.mimeType === "image/gif") {
          return { type: "image", source: { type: "base64", media_type: part.mimeType, data: part.data } };
        }
        throw new AiServiceError(`지원하지 않는 파일 형식: ${part.mimeType}`, 400, "bad_request");
      });

      let response: Anthropic.Message;
      try {
        response = await client.messages.create(
          {
            model: MODEL,
            max_tokens: 16000,
            system: `${request.system}\n결과는 ${request.name} 도구를 정확히 한 번 호출해 기록한다.`,
            tools: [tool],
            tool_choice: { type: "auto", disable_parallel_tool_use: true },
            output_config: { effort: "medium" },
            messages: [{ role: "user", content }],
          },
          { signal: request.signal },
        );
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) throw new AiServiceError("AI 키가 올바르지 않아요", 503, "auth");
        if (error instanceof Anthropic.RateLimitError) throw new AiServiceError("AI 요청이 많아 잠시 후 다시 시도해야 해요", 429, "rate_limit");
        if (error instanceof Anthropic.BadRequestError) throw new AiServiceError(`AI 요청 형식 오류: ${error.message}`, 400, "bad_request");
        if (error instanceof Anthropic.APIError) throw new AiServiceError(`AI 서버 오류(${error.status ?? "연결"})`, 502, "upstream");
        throw error;
      }
      if (response.stop_reason === "refusal") throw new AiServiceError("AI가 이 요청을 처리하지 않았어요", 502, "blocked");
      if (response.stop_reason === "max_tokens") throw new AiServiceError("AI 응답이 길이 제한에 걸렸어요", 502, "format");
      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === request.name,
      );
      if (!toolUse) throw new AiServiceError("AI가 결과 형식을 지키지 않았어요", 502, "format");
      return toolUse.input;
    },
  };
}
