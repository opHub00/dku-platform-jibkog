import type { Won } from "../types";

const EOK = 100_000_000;
const MAN = 10_000;

/**
 * 원 단위 금액을 "24억 8,000만" 형식으로 바꾼다.
 * 만 원 미만은 버린다. 1만 원 미만이면 "n원"으로 보여준다.
 */
export function formatWon(won: Won): string {
  const sign = won < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(won));
  if (abs < MAN) return `${sign}${abs.toLocaleString("ko-KR")}원`;

  const eok = Math.floor(abs / EOK);
  const man = Math.floor((abs % EOK) / MAN);
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만`);
  return sign + parts.join(" ");
}

/**
 * 요약 표기용. 1억 이상은 "3.2억"처럼 소수 한 자리, 미만은 "4,800만".
 */
export function formatWonShort(won: Won): string {
  const abs = Math.abs(won);
  if (abs < EOK) return formatWon(won);
  const eok = Math.round((won / EOK) * 10) / 10;
  return `${Number.isInteger(eok) ? eok.toFixed(0) : eok.toFixed(1)}억`;
}

/** "2027-08" → "2027. 08" */
export function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  return `${year}. ${month}`;
}

/** 0.148 → "14.8%" */
export function formatRate(rate: number): string {
  return `${(Math.round(rate * 1000) / 10).toString()}%`;
}

/** 등록 시각을 "방금 전", "3시간 전", "어제", "5일 전"으로 바꾼다. */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 5) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
