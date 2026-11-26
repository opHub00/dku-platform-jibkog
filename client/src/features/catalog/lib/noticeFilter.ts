import type { Notice, NoticeStatus } from "../types";

/** 마감 뒤에도 목록·지도에 남겨 두는 기간(일) */
export const RECENT_CLOSED_DAYS = 14;

/** 오늘 날짜 "YYYY-MM-DD"(한국 시간) */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 매물 탭·홈에 보여줄 공고: 접수 중·접수 예정 + 마감 후 RECENT_CLOSED_DAYS일 이내.
 * 실제 수집 데이터는 3년치(500건 이상)라 전부 보여주면 지도와 목록이 공고로 덮인다. 지난 공고는 단지 검색·상세로 본다.
 */
export function isCurrentNotice(notice: Pick<Notice, "status" | "applicationsCloseOn">, now: Date = new Date()): boolean {
  return isCurrentStatus(notice.status, notice.applicationsCloseOn, now);
}

export function isCurrentStatus(status: NoticeStatus, applicationsCloseOn: string, now: Date = new Date()): boolean {
  if (status !== "closed") return true;
  const days = (Date.parse(`${todayKst(now)}T00:00:00Z`) - Date.parse(`${applicationsCloseOn}T00:00:00Z`)) / 86_400_000;
  return days <= RECENT_CLOSED_DAYS;
}

/** 지역 필터: "서울"(시·도)이나 "서울 영등포구"(시군구) 모두 받는다 */
export function matchesRegion(district: string | null | undefined, region: string | null): boolean {
  if (region === null) return true;
  if (!district) return false;
  return district === region || district.startsWith(`${region} `);
}
