import type { AreaPreference, IncomeBracket, SubscriptionPeriod, UserProfile } from "../types";

/** 저장 전 기본값. 지금 화면에 하드코딩된 값(주예나, 서울 서초구, 무주택 3년)과 같다. */
export const DEFAULT_PROFILE: UserProfile = {
  name: "주예나",
  age: null,
  residence: { sido: "서울", sigungu: "서초구" },
  homelessYears: 3,
  incomeBracket: null,
  subscriptionPeriod: null,
  interestRegions: [{ sido: "서울", sigungu: "서초구" }],
  interestAreas: [],
  budgetMin: null,
  budgetMax: null,
  savedAt: null,
};

/** 거주지 시도 선택지 */
export const SIDO_OPTIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;

export const INCOME_OPTIONS: { value: IncomeBracket; label: string }[] = [
  { value: "under30", label: "3천만 원 미만" },
  { value: "30to50", label: "3천~5천만 원" },
  { value: "50to70", label: "5천~7천만 원" },
  { value: "70to100", label: "7천만~1억 원" },
  { value: "over100", label: "1억 원 이상" },
];

export const SUBSCRIPTION_OPTIONS: { value: SubscriptionPeriod; label: string }[] = [
  { value: "under6m", label: "6개월 미만" },
  { value: "6mTo1y", label: "6개월~1년" },
  { value: "1to2y", label: "1~2년" },
  { value: "2to5y", label: "2~5년" },
  { value: "5to10y", label: "5~10년" },
  { value: "over10y", label: "10년 이상" },
];

export const AREA_OPTIONS: { value: AreaPreference; label: string }[] = [
  { value: "upTo59", label: "59㎡ 이하" },
  { value: "60to84", label: "60~84㎡" },
  { value: "over85", label: "85㎡ 이상" },
];

export const NAME_MAX_LENGTH = 10;
export const SIGUNGU_MAX_LENGTH = 12;
