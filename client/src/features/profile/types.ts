/**
 * 내 정보(프로필). 소득·나이·무주택 기간 같은 민감 정보가 들어 있으므로
 * profileRepository 밖으로 보내지 않는다(다른 기능의 API·AI 요청에 넣지 않는다).
 */

export type Region = {
  sido: string;
  sigungu: string;
};

/** 연소득 구간. 금액이 아니라 구간으로만 받는다. */
export type IncomeBracket = "under30" | "30to50" | "50to70" | "70to100" | "over100";

/** 청약통장 가입 기간 */
export type SubscriptionPeriod = "under6m" | "6mTo1y" | "1to2y" | "2to5y" | "5to10y" | "over10y";

/** 관심 면적(전용 기준) */
export type AreaPreference = "upTo59" | "60to84" | "over85";

export type UserProfile = {
  /** 이름(닉네임). 필수 */
  name: string;
  /** 만 나이. 선택 */
  age: number | null;
  /** 거주지. 필수 */
  residence: Region;
  /** 무주택 기간(년). 선택 */
  homelessYears: number | null;
  incomeBracket: IncomeBracket | null;
  subscriptionPeriod: SubscriptionPeriod | null;
  /** 관심지역. 1개 이상 필수 */
  interestRegions: Region[];
  interestAreas: AreaPreference[];
  /** 예산 범위(원 단위 정수). 선택 */
  budgetMin: number | null;
  budgetMax: number | null;
  /** 마지막 저장 시각. 저장 전 기본값이면 null */
  savedAt: string | null;
};

export type ProfileField = "name" | "age" | "residence" | "homelessYears" | "interestRegions" | "budget";

export type ProfileErrors = Partial<Record<ProfileField, string>>;
