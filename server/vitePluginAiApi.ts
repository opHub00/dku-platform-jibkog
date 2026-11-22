import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import {
  CONTRACT_MEDIA_TYPES,
  type AiApiResponse,
  type ContractMediaType,
} from "../client/src/features/presale/ai/types";
import { AiServiceError, extractContract, screenDescription } from "./ai";

/** base64 PDF·이미지가 들어오므로 넉넉히 잡는다(Messages API 요청 한도 32MB 미만). */
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 5_000;

/**
 * .env / .env.local 파일에서만 ANTHROPIC_API_KEY를 읽는다.
 * 셸 환경변수는 보지 않는다. VITE_ 접두사가 없으므로 클라이언트 번들에는 들어가지 않는다.
 */
function readApiKeyFromDotenv(envDir: string): string | null {
  let key: string | null = null;
  for (const file of [".env", ".env.local"]) {
    const fullPath = path.join(envDir, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = /^\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const value = match[1].replace(/^(['"])(.*)\1$/, "$2").trim();
      if (value !== "") key = value; // .env.local이 .env를 덮어쓴다
    }
  }
  return key;
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError("파일이 너무 커요(20MB 이하)", 413));
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

export function aiApiPlugin(options: { envDir: string }): Plugin {
  return {
    name: "zipcok-ai-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/api/ai/extract-contract" && url !== "/api/ai/screen-description") {
          next();
          return;
        }
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST만 지원해요" });
          return;
        }

        // 요청마다 다시 읽어서 .env를 고친 뒤 서버를 재시작하지 않아도 반영되게 한다.
        const apiKey = readApiKeyFromDotenv(options.envDir);
        if (!apiKey) {
          sendJson(res, 503, { ok: false, error: "AI 키가 설정되지 않았어요" });
          return;
        }

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
            const result = await extractContract(apiKey, { mediaType, data }, abort.signal);
            sendJson(res, 200, { ok: true, result });
          } else {
            const { description } = body;
            if (typeof description !== "string" || description.trim() === "") {
              throw new HttpError("설명이 비어 있어요", 400);
            }
            if (description.length > MAX_DESCRIPTION_LENGTH) {
              throw new HttpError("설명이 너무 길어요", 400);
            }
            const result = await screenDescription(apiKey, description, abort.signal);
            sendJson(res, 200, { ok: true, result });
          }
        } catch (error) {
          if (abort.signal.aborted) return;
          if (error instanceof HttpError || error instanceof AiServiceError) {
            sendJson(res, error.status, { ok: false, error: error.message });
            return;
          }
          server.config.logger.error(
            `[zipcok-ai-api] ${error instanceof Error ? error.message : String(error)}`,
          );
          sendJson(res, 500, { ok: false, error: "AI 처리 중 오류가 났어요" });
        }
      });
    },
  };
}
