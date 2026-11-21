import { demoExtractContract, demoScreenDescription, type ContractHint } from "./demoRules";
import {
  CONTRACT_MEDIA_TYPES,
  parseContractExtraction,
  parseDescriptionScreening,
  type AiResult,
  type ContractExtraction,
  type ContractMediaType,
  type DescriptionScreening,
} from "./types";

/**
 * /api/ai/* 호출. 서버가 503(키 없음)이거나 실패하면 규칙 기반 데모 결과로 대체한다.
 * 반환값의 mode로 실제 AI 결과("live")인지 데모("demo")인지 구분한다.
 */

const REQUEST_TIMEOUT_MS = 90_000;

async function postJson(path: string, body: unknown): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null; // 503(키 없음) 포함
    const json: unknown = await response.json();
    if (
      typeof json === "object" &&
      json !== null &&
      "ok" in json &&
      json.ok === true &&
      "result" in json
    ) {
      return json.result;
    }
    return null;
  } catch {
    return null; // 네트워크 오류·타임아웃·빌드 결과물(개발 서버 없음)
  } finally {
    clearTimeout(timer);
  }
}

function isContractMediaType(value: string): value is ContractMediaType {
  return (CONTRACT_MEDIA_TYPES as readonly string[]).includes(value);
}

async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * 분양계약서(PDF·JPG·PNG·WEBP)를 인식한다.
 * hint는 데모 모드에서만 쓰인다(매물 등록 정보를 그대로 돌려줌, 신뢰도 낮음).
 */
export async function extractContract(
  file: File,
  hint: ContractHint,
): Promise<AiResult<ContractExtraction>> {
  if (isContractMediaType(file.type)) {
    const data = await fileToBase64(file);
    const raw = await postJson("/api/ai/extract-contract", { mediaType: file.type, data });
    const parsed = raw === null ? null : parseContractExtraction(raw);
    if (parsed) return { mode: "live", result: parsed };
  }
  return { mode: "demo", result: demoExtractContract(hint) };
}

export async function screenDescription(
  description: string,
): Promise<AiResult<DescriptionScreening>> {
  if (description.trim() !== "") {
    const raw = await postJson("/api/ai/screen-description", { description });
    const parsed = raw === null ? null : parseDescriptionScreening(raw);
    if (parsed) return { mode: "live", result: parsed };
  }
  return { mode: "demo", result: demoScreenDescription(description) };
}
