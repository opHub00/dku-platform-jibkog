import type { Buyer } from "../types";

/** 로그인 기능이 붙기 전까지 쓰는 현재 구매자 더미 */
export const currentBuyer: Buyer = {
  nickname: "예나",
  realName: "주예나",
  identityVerified: true,
  tradeCount: 1,
  maxBudget: 2_400_000_000,
  desiredMoveInMonth: "2027-08",
};
