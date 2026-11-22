import type { AreaPreference, Region } from "@/features/profile/types";
import { NEWS_QUERY_LIMIT, NEWS_QUERY_MAX_LENGTH, NEWS_QUERY_PATTERN } from "../types";

/** 검색어에 쓰는 관심지역 수(지역마다 검색어 2개, 최대 6개) */
const MAX_REGIONS = NEWS_QUERY_LIMIT / 2;

const AREA_KEYWORDS: Record<AreaPreference, string> = {
  upTo59: "소형",
  "60to84": "84㎡",
  over85: "중대형",
};

/**
 * 검색에 쓰는 지역 이름. "과천시" → "과천", "마포구" → "마포구",
 * 두 글자 구(예: 인천 서구)는 시도를 붙여 "인천 서구".
 */
export function searchRegionName(region: Region): string {
  const sigungu = region.sigungu.trim();
  if (sigungu.endsWith("시") && sigungu.length > 2) return sigungu.slice(0, -1);
  if (sigungu.length <= 2) return `${region.sido} ${sigungu}`;
  return sigungu;
}

/**
 * 관심지역·관심 면적으로 검색어를 만든다. 예: ["과천 분양권", "과천 청약 84㎡", "마포구 분양권", ...]
 * 프로필의 다른 정보(소득·나이·무주택 기간 등)는 쓰지 않는다.
 */
export function buildNewsQueries(regions: Region[], areas: AreaPreference[]): string[] {
  const areaKeyword = areas.length === 1 ? AREA_KEYWORDS[areas[0]] : null;
  const queries: string[] = [];
  for (const region of regions.slice(0, MAX_REGIONS)) {
    const name = searchRegionName(region);
    queries.push(`${name} 분양권`);
    queries.push(areaKeyword ? `${name} 청약 ${areaKeyword}` : `${name} 청약`);
  }
  return [...new Set(queries)].filter(
    (query) => query.length <= NEWS_QUERY_MAX_LENGTH && NEWS_QUERY_PATTERN.test(query),
  );
}
