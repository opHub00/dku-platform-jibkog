import type { PresaleListing, Won } from "../types";

type FundsInput = Pick<
  PresaleListing,
  "salePrice" | "premium" | "optionCost" | "paidAmount"
>;

/** 총 필요자금 = 분양가 + 프리미엄 + 옵션비 */
export function calcTotalRequiredFunds(listing: FundsInput): Won {
  return listing.salePrice + listing.premium + listing.optionCost;
}

/** 계약 시 판매자에게 지급하는 금액 = 프리미엄 + 판매자가 이미 납부한 금액 */
export function calcPaymentAtContract(listing: FundsInput): Won {
  return listing.premium + listing.paidAmount;
}

/** 계약 이후 시행사에 남은 납부액 = 총 필요자금 - 계약 시 지급액 */
export function calcRemainingPayment(listing: FundsInput): Won {
  return calcTotalRequiredFunds(listing) - calcPaymentAtContract(listing);
}

/** 분양가 대비 프리미엄률 */
export function calcPremiumRate(
  listing: Pick<PresaleListing, "salePrice" | "premium">,
): number {
  if (listing.salePrice <= 0) return 0;
  return listing.premium / listing.salePrice;
}

export type FundsBreakdown = {
  totalRequired: Won;
  atContract: Won;
  remaining: Won;
};

export function calcFundsBreakdown(listing: FundsInput): FundsBreakdown {
  return {
    totalRequired: calcTotalRequiredFunds(listing),
    atContract: calcPaymentAtContract(listing),
    remaining: calcRemainingPayment(listing),
  };
}
