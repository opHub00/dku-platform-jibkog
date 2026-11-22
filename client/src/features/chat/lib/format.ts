import { formatWon } from "@/features/presale/lib/format";

const pad = (n: number) => String(n).padStart(2, "0");

/** 목록 시간: 오늘이면 "10:42", 어제면 "어제", 그 전이면 "11. 17" */
export function formatChatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.getTime() >= startOfToday - 86_400_000) return "어제";
  return `${date.getMonth() + 1}. ${pad(date.getDate())}`;
}

/** 말풍선 시간: "오후 3:05" */
export function formatBubbleTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getHours();
  return `${hours < 12 ? "오전" : "오후"} ${hours % 12 === 0 ? 12 : hours % 12}:${pad(date.getMinutes())}`;
}

/** "24억 6,000만" → { head: "24억", tail: "6,000만" } (가격 제안 시트의 b > em 구조용) */
export function splitWon(won: number): { head: string; tail: string } {
  const text = formatWon(won);
  const [head, ...rest] = text.split(" ");
  return { head, tail: rest.join(" ") };
}

const TEN_MILLION = 10_000_000;

/** 가격 제안 기본값: 총 필요자금에서 1.5% 낮춘 뒤 천만 원 단위로 내린 금액 */
export function suggestedOffer(totalRequired: number): number {
  return Math.max(TEN_MILLION, Math.floor((totalRequired * 0.985) / TEN_MILLION) * TEN_MILLION);
}
