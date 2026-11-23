import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiErrorBody } from "../../client/src/features/auth/types";

/** API 오류. 응답 본문은 { error: { code, message } } */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, "unauthorized", "로그인이 필요해요");
export const forbidden = (message = "권한이 없어요") => new ApiError(403, "forbidden", message);
export const notFound = (what = "대상") => new ApiError(404, "not_found", `${what}을(를) 찾을 수 없어요`);
export const badRequest = (message: string) => new ApiError(400, "bad_request", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);

const MAX_BODY_BYTES = 256 * 1024;

export function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // CSRF 완화: 다른 사이트의 폼은 application/json 본문을 보낼 수 없다(브라우저가 사전 확인을 요구).
    const type = req.headers["content-type"] ?? "";
    if (!type.toLowerCase().startsWith("application/json")) {
      reject(new ApiError(415, "unsupported_media_type", "Content-Type: application/json으로 보내주세요"));
      req.resume();
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ApiError(413, "payload_too_large", "요청이 너무 커요"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(badRequest("JSON 형식이 올바르지 않아요"));
      }
    });
    req.on("error", reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

export function sendError(res: ServerResponse, error: ApiError): void {
  const body: ApiErrorBody = { error: { code: error.code, message: error.message } };
  sendJson(res, error.status, body);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw badRequest("요청 본문은 JSON 객체여야 해요");
  return value;
}

export function intField(body: Record<string, unknown>, key: string, opts: { min?: number; max?: number; optional?: boolean } = {}): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    if (opts.optional) return undefined;
    throw badRequest(`${key} 값이 필요해요`);
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw badRequest(`${key}는 정수여야 해요`);
  if (opts.min !== undefined && value < opts.min) throw badRequest(`${key}는 ${opts.min} 이상이어야 해요`);
  if (opts.max !== undefined && value > opts.max) throw badRequest(`${key}는 ${opts.max} 이하여야 해요`);
  return value;
}

export function stringField(body: Record<string, unknown>, key: string, opts: { min?: number; max?: number } = {}): string {
  const value = body[key];
  if (typeof value !== "string") throw badRequest(`${key} 값이 필요해요`);
  const trimmed = value.trim();
  if (opts.min !== undefined && trimmed.length < opts.min) throw badRequest(`${key}는 ${opts.min}자 이상이어야 해요`);
  if (opts.max !== undefined && trimmed.length > opts.max) throw badRequest(`${key}는 ${opts.max}자 이하여야 해요`);
  return trimmed;
}
