import type { Listing } from "@/types";
import type { Notice, NoticeStatus } from "../types";

/** 공고 상태 이름(가격 자리·배지에 쓴다) */
export const NOTICE_STATUS_LABELS: Record<NoticeStatus, string> = {
  upcoming: "청약 예정",
  open: "청약 접수 중",
  closed: "청약 마감",
};

/** "2026-11-23" → "11. 23" */
export function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}. ${day}`;
}

/** "2026-11-23" → "2026. 11. 23" */
export function formatFullDay(date: string): string {
  return date.replace(/-/g, ". ");
}

/** "2030-03" → "2030년 3월" */
export function formatMonthKorean(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}년 ${Number(month)}월`;
}

/** "서울특별시 영등포구 문래동3가 27-1번지 일원" → "서울 영등포구 문래동3가" */
export function shortAddress(notice: Pick<Notice, "address" | "region">): string {
  const [, sigungu, dong] = notice.address.split(/\s+/);
  return [notice.region, sigungu, dong?.replace(/\(.*$/, "")].filter(Boolean).join(" ");
}

/** 공고일 기준 "오늘", "어제", "5일 전" */
export function relativeDay(date: string, today: Date = new Date()): string {
  const start = new Date(`${date}T00:00:00+09:00`).getTime();
  const days = Math.floor((today.getTime() - start) / 86_400_000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  return formatFullDay(date);
}

/** 공고를 기존 화면(ListingCard, 상세, 지도 핀)이 쓰는 Listing으로 바꾼다 */
export function noticeToListing(notice: Notice, today: Date = new Date()): Listing {
  const sigungu = notice.address.split(/\s+/)[1] ?? "";
  return {
    id: Number(notice.id),
    type: "notice",
    title: notice.title,
    location: shortAddress(notice),
    price: NOTICE_STATUS_LABELS[notice.status],
    detail: `신청 ${formatDay(notice.applicationsOpenOn)} ~ ${formatDay(notice.applicationsCloseOn)} · 총 ${notice.totalUnits.toLocaleString("ko-KR")}세대`,
    date: relativeDay(notice.publishedOn, today),
    image: "/assets/modern-home.jpg",
    tag: "청약공고",
    tagTone: "navy",
    notice,
    ...(notice.location ? { lat: notice.location.lat, lng: notice.location.lng } : {}),
    district: `${notice.region} ${sigungu}`,
  };
}
