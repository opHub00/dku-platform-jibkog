import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  CONTRACT_MEDIA_TYPES,
  type AiApiResponse,
  type ContractMediaType,
} from "../client/src/features/presale/ai/types";
import { parseNewsRequest } from "../client/src/features/news/types";
import { extractContract, screenDescription } from "./ai";
import { readDotenvValue } from "./env";
import { AiServiceError, selectLlm } from "./llm";
import { getNews, type NaverKeys } from "./news";

/** base64 PDF·이미지가 들어오므로 넉넉히 잡는다. */
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 5_000;
/** 뉴스 요청은 작은 JSON(검색어 목록)뿐이다. */
const MAX_NEWS_BODY_BYTES = 4 * 1024;

function readNaverKeys(envDir: string): NaverKeys | null {
  const clientId = readDotenvValue(envDir, "NAVER_CLIENT_ID");
  const clientSecret = readDotenvValue(envDir, "NAVER_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function readJsonBody(req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(maxBytes === MAX_BODY_BYTES ? "파일이 너무 커요(20MB 이하)" : "요청이 너무 커요", 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError("요청 형식이 올바르지 않아요", 400));
      }
    });
    req.on("error", reject);
  });
}

function sendJson<T>(res: ServerResponse, status: number, body: AiApiResponse<T>): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContractMediaType(value: unknown): value is ContractMediaType {
  return typeof value === "string" && (CONTRACT_MEDIA_TYPES as readonly string[]).includes(value);
}

type Logger = { warn: (message: string) => void; error: (message: string) => void };

/** AI 오류를 서버 로그에 남긴다. 무료 한도 초과(429)는 따로 표시한다. */
function logAiError(logger: Logger, scope: string, error: AiServiceError): void {
  if (error.reason === "rate_limit") logger.warn(`[${scope}] AI 무료 한도 초과(429): ${error.message} → 데모 모드로 대체`);
  else logger.warn(`[${scope}] ${error.message} → 데모 모드로 대체`);
}

async function handleNews(req: IncomingMessage, res: ServerResponse, envDir: string, logger: Logger): Promise<void> {
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });
  try {
    const body = await readJsonBody(req, MAX_NEWS_BODY_BYTES);
    // 검색어 외의 필드가 있으면 거부한다(프로필 정보가 섞여 들어오지 않게).
    const request = parseNewsRequest(body);
    if (!request) throw new HttpError("검색어 형식이 올바르지 않아요", 400);
    const selection = selectLlm(envDir);
    const result = await getNews(request.queries, {
      naverKeys: readNaverKeys(envDir),
      llm: selection.llm,
      signal: abort.signal,
      onError: (message) => logger.warn(`[zipcok-news] ${message}`),
    });
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    if (abort.signal.aborted) return;
    if (error instanceof HttpError) {
      sendJson(res, error.status, { ok: false, error: error.message });
      return;
    }
    logger.warn(`[zipcok-news] ${error instanceof Error ? error.message : String(error)}`);
    sendJson(res, 500, { ok: false, error: "뉴스를 불러오지 못했어요" });
  }
}

export function aiApiPlugin(options: { envDir: string }): Plugin {
  return {
    name: "zipcok-ai-api",
    apply: "serve",
    configureServer(server) {
      const logger: Logger = {
        warn: (message) => server.config.logger.warn(message),
        error: (message) => server.config.logger.error(message),
      };
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/ai/extract-contract" && url !== "/api/ai/screen-description" && url !== "/api/news") {
          next();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST만 지원해요" });
          return;
        }

        // 뉴스는 AI 키가 없어도 샘플·규칙 분류로 200을 돌려준다(AI 설정 확인보다 먼저 처리).
        if (url === "/api/news") {
          await handleNews(req, res, options.envDir, logger);
          return;
        }

        // 요청마다 .env를 다시 읽어 공급자(AI_PROVIDER, 기본 gemini)를 고른다.
        const selection = selectLlm(options.envDir);
        if (!selection.llm) {
          sendJson(res, 503, { ok: false, error: `AI가 설정되지 않았어요: ${selection.reason}` });
          return;
        }
        const llm = selection.llm;

        const abort = new AbortController();
        res.on("close", () => {
          if (!res.writableEnded) abort.abort();
        });

        try {
          const body = await readJsonBody(req);
          if (!isRecord(body)) throw new HttpError("요청 형식이 올바르지 않아요", 400);

          if (url === "/api/ai/extract-contract") {
            const { mediaType, data } = body;
            if (!isContractMediaType(mediaType) || typeof data !== "string" || data === "") {
              throw new HttpError("PDF 또는 이미지 파일만 올릴 수 있어요", 400);
            }
            const result = await extractContract(llm, { mediaType, data }, abort.signal);
            sendJson(res, 200, { ok: true, result, analyzedBy: llm.info });
          } else {
            const { description } = body;
            if (typeof description !== "string" || description.trim() === "") {
              throw new HttpError("설명이 비어 있어요", 400);
            }
            if (description.length > MAX_DESCRIPTION_LENGTH) {
              throw new HttpError("설명이 너무 길어요", 400);
            }
            const result = await screenDescription(llm, description, abort.signal);
            sendJson(res, 200, { ok: true, result, analyzedBy: llm.info });
          }
        } catch (error) {
          if (abort.signal.aborted) return;
          if (error instanceof AiServiceError) {
            logAiError(logger, "zipcok-ai-api", error);
            sendJson(res, error.status, { ok: false, error: error.message });
            return;
          }
          if (error instanceof HttpError) {
            sendJson(res, error.status, { ok: false, error: error.message });
            return;
          }
          logger.error(`[zipcok-ai-api] ${error instanceof Error ? error.message : String(error)}`);
          sendJson(res, 500, { ok: false, error: "AI 처리 중 오류가 났어요" });
        }
      });
    },
  };
}
