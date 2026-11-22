/**
 * 서버(server/news.ts)와 클라이언트가 함께 쓰는 뉴스 타입.
 * server에서도 import하므로 이 파일과 data/, lib/text.ts, lib/classify.ts에는 "@/" 경로 import를 두지 않는다.
 *
 * 제안서 원칙: 기사 본문은 가져오지 않는다. 제목·요약·원문 링크·날짜만 쓴다.
 */

import { parseAiModelInfo, type AiModelInfo } from "../presale/ai/types";

export const NEWS_CATEGORIES = ["subscription", "presalePrice", "policy", "development", "other"] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  subscription: "청약 일정",
  presalePrice: "분양권 시세",
  policy: "정책·규제",
  development: "개발 호재",
  other: "기타",
};

export type NewsArticle = {
  id: string;
  title: string;
  /** 검색 API가 주는 짧은 요약(본문 아님) */
  summary: string;
  /** 원문 링크 */
  link: string;
  publishedAt: string;
  /** 이 기사를 찾은 검색어 */
  query: string;
  category: NewsCategory;
  /** 내 관심지역에 왜 중요한지 한 줄 */
  whyItMatters: string;
};

/** 서버로 보내는 값은 검색어뿐이다. 프로필 정보(소득·나이·무주택 기간 등)는 넣지 않는다. */
export type NewsRequest = {
  queries: string[];
};

export type NewsResponse = {
  /** naver: 네이버 검색 결과, sample: 미리 준비한 샘플 기사 */
  source: "naver" | "sample";
  /** ai: AI 분류, rule: 키워드 규칙 분류(데모) */
  classifiedBy: "ai" | "rule";
  /** classifiedBy가 ai일 때 분류한 모델 */
  analyzedBy?: AiModelInfo;
  articles: NewsArticle[];
};

export const NEWS_QUERY_LIMIT = 6;
export const NEWS_QUERY_MAX_LENGTH = 30;
/** 검색어로 허용하는 문자: 한글·영문·숫자·공백·㎡ */
export const NEWS_QUERY_PATTERN = /^[가-힣a-zA-Z0-9 ㎡]+$/;

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === "string" && (NEWS_CATEGORIES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 서버 요청 본문 검증. 검색어 외의 값이 있으면 거부한다. */
export function parseNewsRequest(value: unknown): NewsRequest | null {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "queries")) return null;
  const { queries } = value;
  if (!Array.isArray(queries) || queries.length === 0 || queries.length > NEWS_QUERY_LIMIT) return null;
  const cleaned: string[] = [];
  for (const query of queries) {
    if (typeof query !== "string") return null;
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > NEWS_QUERY_MAX_LENGTH || !NEWS_QUERY_PATTERN.test(trimmed)) return null;
    if (!cleaned.includes(trimmed)) cleaned.push(trimmed);
  }
  return { queries: cleaned };
}

export function parseNewsResponse(value: unknown): NewsResponse | null {
  if (!isRecord(value)) return null;
  const { source, classifiedBy, articles } = value;
  if ((source !== "naver" && source !== "sample") || (classifiedBy !== "ai" && classifiedBy !== "rule") || !Array.isArray(articles)) return null;
  const parsed: NewsArticle[] = [];
  for (const item of articles) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.title !== "string" ||
      typeof item.summary !== "string" ||
      typeof item.link !== "string" ||
      !/^https?:\/\//.test(item.link) ||
      typeof item.publishedAt !== "string" ||
      typeof item.query !== "string" ||
      !isNewsCategory(item.category) ||
      typeof item.whyItMatters !== "string"
    ) {
      return null;
    }
    parsed.push({
      id: item.id,
      title: item.title,
      summary: item.summary,
      link: item.link,
      publishedAt: item.publishedAt,
      query: item.query,
      category: item.category,
      whyItMatters: item.whyItMatters,
    });
  }
  const analyzedBy = parseAiModelInfo(value.analyzedBy);
  return analyzedBy ? { source, classifiedBy, analyzedBy, articles: parsed } : { source, classifiedBy, articles: parsed };
}
