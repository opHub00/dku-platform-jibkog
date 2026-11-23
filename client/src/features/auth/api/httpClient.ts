import type { ApiErrorBody } from "../types";

/** API 호출 실패. status 401이면 AuthRequiredError */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export class AuthRequiredError extends ApiRequestError {
  constructor(message = "로그인이 필요해요") {
    super(401, "unauthorized", message);
    this.name = "AuthRequiredError";
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "message" in value.error &&
    typeof value.error.message === "string"
  );
}

/**
 * 앱 API(docs/api.md) 호출. 세션은 HttpOnly 쿠키라 자바스크립트로 다루지 않는다(credentials: same-origin).
 * 응답 본문(JSON)을 unknown으로 돌려준다. 형식 검증은 호출하는 쪽이 한다.
 */
export async function apiRequest(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiRequestError(0, "network_error", "서버에 연결하지 못했어요");
  }
  if (response.status === 204) return null;
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    const message = isApiErrorBody(json) ? json.error.message : `요청에 실패했어요(${response.status})`;
    const code = isApiErrorBody(json) && "code" in json.error && typeof json.error.code === "string" ? json.error.code : "error";
    if (response.status === 401) throw new AuthRequiredError(message);
    throw new ApiRequestError(response.status, code, message);
  }
  return json;
}

export function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value ? (value as Record<string, unknown>)[key] : undefined;
}
