import type { NewsCategory } from "../types";

/**
 * AI를 쓸 수 없을 때(키 없음·오류) 쓰는 키워드 규칙 분류(데모 모드).
 * 위에서부터 먼저 걸린 카테고리를 쓴다(전매제한은 시세보다 정책으로 본다).
 */
const RULES: { category: NewsCategory; pattern: RegExp }[] = [
  { category: "subscription", pattern: /청약\s?일정|모집\s?공고|1순위|2순위|특별\s?공급|일반\s?공급|청약홈|당첨|분양\s?일정|견본주택|모델하우스/ },
  { category: "policy", pattern: /규제|대출|LTV|DSR|DTI|정책|세금|취득세|양도세|보유세|전매\s?제한|특례|법안|개정|금리|투기과열|조정대상/i },
  { category: "presalePrice", pattern: /분양권|프리미엄|웃돈|시세|실거래|매매가|호가|거래량|분양가/ },
  { category: "development", pattern: /개발|GTX|역세권|착공|개통|재건축|재개발|정비사업|교통|신도시|호재|노선|산업단지/i },
];

/** 제목으로 먼저 분류하고, 제목에서 안 걸리면 요약을 본다(요약의 곁가지 단어에 끌려가지 않게). */
export function classifyByRules(title: string, summary: string): NewsCategory {
  return (
    RULES.find((rule) => rule.pattern.test(title))?.category ??
    RULES.find((rule) => rule.pattern.test(summary))?.category ??
    "other"
  );
}

/** 검색어에서 지역 이름만 뽑는다. "과천 분양권" → "과천". 샘플이면 "관심지역" */
export function regionFromQuery(query: string): string {
  const first = query.trim().split(/\s+/)[0] ?? "";
  return first === "" || first === "샘플" ? "관심지역" : first;
}

/** 규칙 기반 "왜 중요한지" 한 줄 */
export function whyItMattersByRules(category: NewsCategory, query: string): string {
  const region = regionFromQuery(query);
  switch (category) {
    case "subscription":
      return `${region} 청약 일정을 미리 챙길 수 있어요`;
    case "presalePrice":
      return `${region} 분양권 시세를 가늠하는 데 참고가 돼요`;
    case "policy":
      return `${region} 거래 조건(대출·세금·전매)에 영향을 줄 수 있어요`;
    case "development":
      return `${region} 입지 가치에 영향을 줄 수 있는 소식이에요`;
    default:
      return `${region} 관련 소식이에요`;
  }
}
