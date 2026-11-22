import type { PresaleListing, Won } from "../types";
import { calcTotalRequiredFunds } from "./funds";

/** 전매 양도세 간이 추정 세율. 보유기간이 길수록 낮아진다(데모용 단순화). */
function estimateTransferTaxRate(holdingMonths: number): number {
  if (holdingMonths < 12) return 0.7;
  if (holdingMonths < 24) return 0.6;
  return 0.45;
}

export type RoiInput = {
  /** 예상 보유 개월 수 */
  holdingMonths: number;
  /** 월평균 추가 프리미엄 상승률 */
  monthlyPremiumGrowthRate: number;
};

export type RoiResult = {
  investedAmount: Won;
  expectedPremium: Won;
  expectedSalePrice: Won;
  /** 양도차익 = 예상 프리미엄 - 현재 프리미엄 */
  gain: Won;
  taxRate: number;
  tax: Won;
  netGain: Won;
  /** 투자금 대비 세후 수익률 */
  netReturnRate: number;
};

/**
 * 프리미엄이 매달 일정 비율로 오른다고 가정하고 전매 수익을 추정한다.
 * 세금은 보유기간에 따른 간이 세율로만 계산하는 데모용 추정치다.
 */
export function calcRoi(
  listing: Pick<PresaleListing, "salePrice" | "premium" | "optionCost" | "paidAmount">,
  input: RoiInput,
): RoiResult {
  const investedAmount = calcTotalRequiredFunds(listing);
  const expectedPremium = Math.round(
    listing.premium * (1 + input.monthlyPremiumGrowthRate * input.holdingMonths),
  );
  const expectedSalePrice = listing.salePrice + expectedPremium + listing.optionCost;
  const gain = expectedPremium - listing.premium;
  const taxRate = estimateTransferTaxRate(input.holdingMonths);
  const tax = Math.max(0, Math.round(gain * taxRate));
  const netGain = gain - tax;
  const netReturnRate = investedAmount > 0 ? netGain / investedAmount : 0;

  return {
    investedAmount,
    expectedPremium,
    expectedSalePrice,
    gain,
    taxRate,
    tax,
    netGain,
    netReturnRate,
  };
}
