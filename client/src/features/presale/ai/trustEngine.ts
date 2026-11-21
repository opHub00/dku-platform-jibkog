import { calcPremiumRate } from "../lib/funds";
import { formatRate, formatWon } from "../lib/format";
import { getResaleRestriction } from "../lib/resale";
import type {
  Complex,
  PresaleDocumentType,
  PresaleListing,
  TrustGrade,
  TrustItem,
  TrustItemStatus,
  TrustReport,
  TrustSource,
} from "../types";
import {
  RISK_CATEGORY_LABELS,
  type AiResult,
  type ContractExtraction,
  type DescriptionScreening,
} from "./types";

/**
 * 분양권 매물 신뢰 점수(100점). 점수는 전부 규칙으로 계산한다.
 * AI는 계약서 인식(contract)과 설명 위험 문구(screening) 입력만 만든다.
 *
 * 본인인증 15 + 계약서 대조 30(단지명 10·면적 5·분양가 10·계약자명 5)
 * + 서류 15 + 프리미엄 적정성 20 + 설명 위험 문구 20(건당 -10)
 * 상한: fail 있으면 69, warn 있으면 84, 전매제한 중이면 30(거래 불가)
 */

export const TRUST_SOURCE_LABELS: Record<TrustSource, string> = {
  ai: "AI",
  rule: "규칙",
  public: "공공데이터",
};

/** 등급별 StatusPill tone 제안 */
export const TRUST_GRADE_TONES: Record<TrustGrade, "green" | "navy" | "sand" | "neutral"> = {
  "매우 안전": "green",
  "안전한 편": "navy",
  "주의 필요": "sand",
  위험: "neutral",
};

const PREMIUM_HIGH_RATIO = 1.8;
const PREMIUM_LOW_RATIO = 0.3;
const LOW_CONFIDENCE = 0.6;
const AREA_TOLERANCE_M2 = 1;
const PRICE_TOLERANCE_RATE = 0.001;

const DOCUMENT_LABELS: Record<PresaleDocumentType, string> = {
  salesContract: "분양계약서",
  paymentProof: "납부확인서",
  optionContract: "옵션계약서",
};

export type TrustInput = {
  listing: PresaleListing;
  complex: Complex;
  /** 프리미엄 비교용 전체 매물·단지 */
  allListings: PresaleListing[];
  allComplexes: Complex[];
  /** 분양계약서 인식 결과. 계약서를 내지 않았으면 null */
  contract: AiResult<ContractExtraction> | null;
  screening: AiResult<DescriptionScreening>;
  now?: Date;
};

export function gradeFor(score: number): TrustGrade {
  if (score >= 85) return "매우 안전";
  if (score >= 70) return "안전한 편";
  if (score >= 50) return "주의 필요";
  return "위험";
}

function normalizeName(value: string): string {
  return value.replace(/\s|\(.*?\)|아파트|APT/gi, "").toLowerCase();
}

function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return x !== "" && y !== "" && (x.includes(y) || y.includes(x));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function identityItem(listing: PresaleListing): TrustItem {
  const verified = listing.seller.identityVerified;
  return {
    key: "identity",
    label: "판매자 본인인증",
    score: verified ? 15 : 0,
    maxScore: 15,
    status: verified ? "pass" : "fail",
    description: verified
      ? `본인인증을 마쳤어요 · 거래 이력 ${listing.seller.tradeCount}건`
      : "본인인증을 하지 않은 판매자예요",
    source: "rule",
  };
}

function contractItems(
  listing: PresaleListing,
  complex: Complex,
  contract: AiResult<ContractExtraction> | null,
): TrustItem[] {
  const specs = [
    { key: "contractComplex", label: "계약서 단지명", max: 10 },
    { key: "contractArea", label: "계약서 면적", max: 5 },
    { key: "contractPrice", label: "계약서 분양가", max: 10 },
    { key: "contractName", label: "계약자 = 판매자", max: 5 },
  ] as const;

  if (!contract) {
    return specs.map((spec) => ({
      key: spec.key,
      label: spec.label,
      score: 0,
      maxScore: spec.max,
      status: "fail",
      description: "분양계약서가 없어 대조하지 못했어요",
      source: "rule",
    }));
  }

  const source: TrustSource = contract.mode === "live" ? "ai" : "rule";
  const data = contract.result;
  const lowConfidence = data.confidence < LOW_CONFIDENCE;

  const checks: Record<(typeof specs)[number]["key"], { read: string | null; ok: boolean; expected: string }> = {
    contractComplex: {
      read: data.complexName,
      ok: data.complexName !== null && namesMatch(data.complexName, complex.name),
      expected: complex.name,
    },
    contractArea: {
      read: data.exclusiveArea === null ? null : `${data.exclusiveArea}㎡`,
      ok:
        data.exclusiveArea !== null &&
        Math.abs(data.exclusiveArea - listing.area) <= AREA_TOLERANCE_M2,
      expected: `${listing.area}㎡`,
    },
    contractPrice: {
      read: data.salePrice === null ? null : formatWon(data.salePrice),
      ok:
        data.salePrice !== null &&
        Math.abs(data.salePrice - listing.salePrice) <= listing.salePrice * PRICE_TOLERANCE_RATE,
      expected: formatWon(listing.salePrice),
    },
    contractName: {
      read: data.contractorName,
      ok:
        data.contractorName !== null &&
        normalizeName(data.contractorName) === normalizeName(listing.seller.realName),
      expected: listing.seller.realName,
    },
  };

  return specs.map((spec): TrustItem => {
    const check = checks[spec.key];
    if (check.read === null) {
      return {
        key: spec.key,
        label: spec.label,
        score: 0,
        maxScore: spec.max,
        status: "warn",
        description: "계약서에서 이 값을 읽지 못했어요",
        source,
      };
    }
    if (!check.ok) {
      return {
        key: spec.key,
        label: spec.label,
        score: 0,
        maxScore: spec.max,
        status: "fail",
        description: `계약서는 ${check.read}, 매물 정보는 ${check.expected}로 달라요`,
        source,
      };
    }
    return {
      key: spec.key,
      label: spec.label,
      score: spec.max,
      maxScore: spec.max,
      status: lowConfidence ? "warn" : "pass",
      description: lowConfidence
        ? `${check.read}로 일치하지만 인식 신뢰도가 낮아 다시 확인이 필요해요`
        : `계약서와 매물 정보가 ${check.read}로 일치해요`,
      source,
    };
  });
}

function forgeryItem(contract: AiResult<ContractExtraction> | null): TrustItem | null {
  if (!contract || contract.result.forgeryNotes.length === 0) return null;
  return {
    key: "contractForgery",
    label: "계약서 위변조 의심",
    score: 0,
    maxScore: 0,
    status: "warn",
    description: contract.result.forgeryNotes.join(" · "),
    source: contract.mode === "live" ? "ai" : "rule",
  };
}

function documentsItem(listing: PresaleListing): TrustItem {
  const optionRequired = listing.optionCost > 0;
  let score = 0;
  let worst: TrustItemStatus = "pass";
  const notes: string[] = [];

  for (const type of ["salesContract", "paymentProof", "optionContract"] as const) {
    const status = listing.documents.find((d) => d.type === type)?.status ?? "missing";
    const label = DOCUMENT_LABELS[type];
    if (type === "optionContract" && !optionRequired && status === "missing") {
      score += 5; // 옵션이 없으면 옵션계약서는 필요 없다
      continue;
    }
    if (status === "verified") {
      score += 5;
    } else if (status === "pending") {
      score += 3;
      notes.push(`${label} 확인 중`);
      if (worst === "pass") worst = "warn";
    } else {
      notes.push(`${label} 없음`);
      worst = "fail";
    }
  }

  return {
    key: "documents",
    label: "거래 서류",
    score,
    maxScore: 15,
    status: worst,
    description: notes.length === 0 ? "필요한 서류를 모두 확인했어요" : notes.join(" · "),
    source: "rule",
  };
}

function premiumItem(
  listing: PresaleListing,
  complex: Complex,
  allListings: PresaleListing[],
  allComplexes: Complex[],
): TrustItem {
  const complexById = new Map(allComplexes.map((c) => [c.id, c]));
  const peerRates = allListings
    .filter((other) => {
      if (other.id === listing.id || other.status !== "selling") return false;
      const otherComplex = complexById.get(other.complexId);
      return (
        otherComplex !== undefined &&
        otherComplex.sido === complex.sido &&
        otherComplex.sigungu === complex.sigungu
      );
    })
    .map((other) => calcPremiumRate(other));

  const usePeers = peerRates.length >= 2;
  const reference = usePeers ? median(peerRates) : complex.referencePremiumRate;
  const basis = usePeers
    ? `${complex.sigungu} 거래중 매물 ${peerRates.length}건 중앙값 ${formatRate(reference)}`
    : `단지 참고값 ${formatRate(reference)}`;
  const source: TrustSource = usePeers ? "rule" : "public";
  const rate = calcPremiumRate(listing);

  if (reference <= 0) {
    return {
      key: "premium",
      label: "프리미엄 적정성",
      score: 10,
      maxScore: 20,
      status: "warn",
      description: "비교할 기준값이 없어 적정성을 판단하지 못했어요",
      source,
    };
  }

  const ratio = rate / reference;
  if (ratio > PREMIUM_HIGH_RATIO) {
    return {
      key: "premium",
      label: "프리미엄 적정성",
      score: 0,
      maxScore: 20,
      status: "warn",
      description: `프리미엄률 ${formatRate(rate)}로 ${basis}의 ${ratio.toFixed(1)}배예요. 시세보다 지나치게 높아요`,
      source,
    };
  }
  if (ratio < PREMIUM_LOW_RATIO) {
    return {
      key: "premium",
      label: "프리미엄 적정성",
      score: 5,
      maxScore: 20,
      status: "warn",
      description: `프리미엄률 ${formatRate(rate)}로 ${basis}보다 크게 낮아요. 다운계약 여부를 확인해야 해요`,
      source,
    };
  }
  return {
    key: "premium",
    label: "프리미엄 적정성",
    score: 20,
    maxScore: 20,
    status: "pass",
    description: `프리미엄률 ${formatRate(rate)}로 ${basis}과 비슷해요`,
    source,
  };
}

function descriptionItem(screening: AiResult<DescriptionScreening>): TrustItem {
  const findings = screening.result.findings;
  const source: TrustSource = screening.mode === "live" ? "ai" : "rule";
  if (findings.length === 0) {
    return {
      key: "description",
      label: "설명 위험 문구",
      score: 20,
      maxScore: 20,
      status: "pass",
      description: "위험 문구가 없어요",
      source,
    };
  }
  return {
    key: "description",
    label: "설명 위험 문구",
    score: Math.max(0, 20 - findings.length * 10),
    maxScore: 20,
    status: findings.length >= 2 ? "fail" : "warn",
    description: findings
      .map((f) => `${RISK_CATEGORY_LABELS[f.category]}: "${f.phrase}"`)
      .join(" · "),
    source,
  };
}

function resaleItem(complex: Complex, now: Date): TrustItem {
  const restriction = getResaleRestriction(complex, now);
  return {
    key: "resale",
    label: "전매제한",
    score: 0,
    maxScore: 0,
    status: restriction.restricted ? "fail" : "pass",
    description: restriction.restricted
      ? `${restriction.endsOn}까지 전매제한이라 거래할 수 없어요(${restriction.daysLeft}일 남음)`
      : restriction.endsOn
        ? `${restriction.endsOn}에 전매제한이 풀렸어요`
        : "전매제한이 없는 단지예요",
    source: "public",
  };
}

export function evaluateTrust(input: TrustInput): TrustReport {
  const now = input.now ?? new Date();
  const { listing, complex } = input;

  const items: TrustItem[] = [
    resaleItem(complex, now),
    identityItem(listing),
    ...contractItems(listing, complex, input.contract),
  ];
  const forgery = forgeryItem(input.contract);
  if (forgery) items.push(forgery);
  items.push(
    documentsItem(listing),
    premiumItem(listing, complex, input.allListings, input.allComplexes),
    descriptionItem(input.screening),
  );

  const rawScore = items.reduce((sum, item) => sum + item.score, 0);
  const restricted = items.some((i) => i.key === "resale" && i.status === "fail");
  const hasFail = items.some((i) => i.status === "fail");
  const hasWarn = items.some((i) => i.status === "warn");

  let score = rawScore;
  const caps: string[] = [];
  if (hasFail && score > 69) {
    score = 69;
    caps.push("확인 실패 항목이 있어 최대 69점");
  } else if (!hasFail && hasWarn && score > 84) {
    score = 84;
    caps.push("주의 항목이 있어 최대 84점");
  }
  if (restricted && score > 30) {
    score = 30;
    caps.push("전매제한 기간이라 최대 30점");
  }

  const usedLive =
    input.screening.mode === "live" || input.contract?.mode === "live";

  return {
    score,
    rawScore,
    grade: gradeFor(score),
    tradable: !restricted,
    caps,
    items,
    mode: usedLive ? "live" : "demo",
    evaluatedAt: now.toISOString(),
  };
}
