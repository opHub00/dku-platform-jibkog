import type {
  ContractExtraction,
  DescriptionScreening,
  RiskCategory,
  RiskFinding,
} from "./types";

/**
 * AI를 쓸 수 없을 때(키 없음·오류) 쓰는 규칙 기반 데모 구현.
 */

const RISK_RULES: { category: RiskCategory; pattern: RegExp; reason: string }[] = [
  {
    category: "external_contact",
    pattern:
      /[^.!?\n]*(카톡|카카오톡|오픈채팅|텔레그램|라인\s?ID|010[-\s]?\d{3,4}|문자\s?(주세요|주시면)|직거래)[^.!?\n]*/,
    reason: "플랫폼 밖 연락을 유도하면 안전거래 보호를 받을 수 없어요",
  },
  {
    category: "down_contract",
    pattern: /[^.!?\n]*(다운\s?계약|업\s?계약|낮게\s?신고|금액(을|은)?\s?낮춰|이면\s?계약)[^.!?\n]*/,
    reason: "실거래가와 다르게 신고하면 매수자도 과태료·세금 추징 대상이 돼요",
  },
  {
    category: "prepayment",
    pattern:
      /[^.!?\n]*(가계약금|선입금|예약금|입금\s?먼저|먼저\s?(보내|입금|송금)|계약금\s?먼저)[^.!?\n]*/,
    reason: "계약서 없이 돈을 먼저 보내면 돌려받기 어려워요",
  },
  {
    category: "resale_evasion",
    pattern:
      /[^.!?\n]*(전매제한\s?(기간\s?)?(중에도|상관\s?없|피해|회피|풀리기\s?전)|공증|권리\s?포기|복등기|명의는?\s?나중)[^.!?\n]*/,
    reason: "전매제한을 피하는 거래는 계약이 무효가 되고 처벌받을 수 있어요",
  },
];

/** 카테고리마다 처음 걸린 문장 하나를 기록한다. */
export function demoScreenDescription(description: string): DescriptionScreening {
  const findings: RiskFinding[] = [];
  for (const rule of RISK_RULES) {
    const match = rule.pattern.exec(description);
    if (match) {
      findings.push({
        category: rule.category,
        phrase: match[0].trim(),
        reason: rule.reason,
      });
    }
  }
  return { findings };
}

export type ContractHint = {
  complexName: string;
  area: number;
  salePrice: number;
  contractorName: string;
};

/**
 * 데모 모드의 계약서 인식. 실제 문서를 읽지 않고 매물 등록 정보를 그대로 돌려준다.
 * 그래서 신뢰도를 낮게(기본 0.55) 두어 trustEngine이 "다시 확인 필요"로 표시하게 한다.
 */
export function demoExtractContract(
  hint: ContractHint,
  confidence = 0.55,
): ContractExtraction {
  return {
    complexName: hint.complexName,
    exclusiveArea: hint.area,
    salePrice: hint.salePrice,
    contractorName: hint.contractorName,
    contractDate: null,
    confidence,
    forgeryNotes: [],
  };
}
