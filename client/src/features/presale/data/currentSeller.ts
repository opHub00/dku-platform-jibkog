import type { Seller } from "../types";

/** 로그인 기능이 붙기 전까지 쓰는 현재 판매자 더미 */
export const currentSeller: Seller = {
  nickname: "집콕회원",
  realName: "한지우",
  identityVerified: true,
  tradeCount: 0,
};
