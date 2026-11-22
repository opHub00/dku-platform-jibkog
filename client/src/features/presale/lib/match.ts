import type { Buyer, Complex, PresaleListing } from "../types";
import { calcTotalRequiredFunds } from "./funds";
import { formatMonth, formatWonShort } from "./format";

export type MatchItemStatus = "match" | "mismatch";

export type MatchItem = {
  label: string;
  buyerValue: string;
  sellerValue: string;
  status: MatchItemStatus;
};

export type MatchSummary = {
  /** 일치 항목 비율 0~100 */
  rate: number;
  items: MatchItem[];
};

/** 구매자 조건과 매물 조건을 비교해 매칭률을 계산한다. */
export function calcMatchSummary(
  presale: PresaleListing,
  complex: Complex,
  buyer: Buyer,
): MatchSummary {
  const totalRequired = calcTotalRequiredFunds(presale);
  const budgetOk = buyer.maxBudget >= totalRequired;
  const moveInOk = buyer.desiredMoveInMonth === complex.moveInMonth;

  const items: MatchItem[] = [
    {
      label: "필요자금",
      buyerValue: `${formatWonShort(buyer.maxBudget)} 준비`,
      sellerValue: `${formatWonShort(totalRequired)} 필요`,
      status: budgetOk ? "match" : "mismatch",
    },
    {
      label: "입주 시기",
      buyerValue: `${formatMonth(buyer.desiredMoveInMonth)} 희망`,
      sellerValue: `${formatMonth(complex.moveInMonth)} 입주`,
      status: moveInOk ? "match" : "mismatch",
    },
  ];

  const matchCount = items.filter((item) => item.status === "match").length;
  const rate = Math.round((matchCount / items.length) * 100);

  return { rate, items };
}
