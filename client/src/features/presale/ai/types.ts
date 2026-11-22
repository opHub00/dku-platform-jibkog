/**
 * 서버(server/ai.ts)와 클라이언트가 함께 쓰는 AI 결과 타입.
 * server에서도 import하므로 이 파일에는 "@/" 경로 import를 두지 않는다.
 */

export type AiMode = "live" | "demo";

/** 분양계약서에서 읽어낸 값. 읽지 못한 값은 null */
export type ContractExtraction = {
  complexName: string | null;
  /** 전용면적(㎡) */
  exclusiveArea: number | null;
  /** 분양가(원) */
  salePrice: number | null;
  contractorName: string | null;
  /** 계약일 "YYYY-MM-DD" */
  contractDate: string | null;
  /** 인식 신뢰도 0~1 */
  confidence: number;
  /** 위변조가 의심되는 부분 메모. 없으면 빈 배열 */
  forgeryNotes: string[];
};

export const RISK_CATEGORIES = [
  "external_contact",
  "down_contract",
  "prepayment",
  "resale_evasion",
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  external_contact: "외부거래 유도",
  down_contract: "다운계약",
  prepayment: "선입금 요구",
  resale_evasion: "전매제한 회피",
};

export type RiskFinding = {
  category: RiskCategory;
  /** 설명에서 그대로 옮긴 문구 */
  phrase: string;
  reason: string;
};

export type DescriptionScreening = {
  findings: RiskFinding[];
};

export type ContractMediaType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export const CONTRACT_MEDIA_TYPES: readonly ContractMediaType[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type ExtractContractRequest = {
  mediaType: ContractMediaType;
  /** base64 문자열(데이터 URL 접두사 없이) */
  data: string;
};

export type ScreenDescriptionRequest = {
  description: string;
};

export type AiApiResponse<T> = { ok: true; result: T } | { ok: false; error: string };

export type AiResult<T> = {
  mode: AiMode;
  result: T;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  return undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

/** 모델·서버 응답을 검증한다. 형식이 틀리면 null */
export function parseContractExtraction(value: unknown): ContractExtraction | null {
  if (!isRecord(value)) return null;
  const complexName = nullableString(value.complexName);
  const exclusiveArea = nullableNumber(value.exclusiveArea);
  const salePrice = nullableNumber(value.salePrice);
  const contractorName = nullableString(value.contractorName);
  const contractDate = nullableString(value.contractDate);
  const confidence = value.confidence;
  const notes = value.forgeryNotes;
  if (
    complexName === undefined ||
    exclusiveArea === undefined ||
    salePrice === undefined ||
    contractorName === undefined ||
    contractDate === undefined ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    !Array.isArray(notes) ||
    !notes.every((n): n is string => typeof n === "string")
  ) {
    return null;
  }
  return {
    complexName,
    exclusiveArea,
    salePrice: salePrice === null ? null : Math.round(salePrice),
    contractorName,
    contractDate,
    confidence: Math.min(1, Math.max(0, confidence)),
    forgeryNotes: notes.filter((n) => n.trim() !== ""),
  };
}

function isRiskCategory(value: unknown): value is RiskCategory {
  return typeof value === "string" && (RISK_CATEGORIES as readonly string[]).includes(value);
}

export function parseDescriptionScreening(value: unknown): DescriptionScreening | null {
  if (!isRecord(value) || !Array.isArray(value.findings)) return null;
  const findings: RiskFinding[] = [];
  for (const item of value.findings) {
    if (
      !isRecord(item) ||
      !isRiskCategory(item.category) ||
      typeof item.phrase !== "string" ||
      typeof item.reason !== "string"
    ) {
      return null;
    }
    findings.push({ category: item.category, phrase: item.phrase, reason: item.reason });
  }
  return { findings };
}
