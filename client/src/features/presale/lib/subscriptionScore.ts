/** 청약 가점제 계산기. 무주택기간·부양가족수·청약통장 가입기간 3개 항목을 합산한다(만점 84점). */

export type HomelessYearsOption = { label: string; years: number };
export const HOMELESS_YEARS_OPTIONS: HomelessYearsOption[] = [
  { label: "1년 미만", years: 0 },
  { label: "3년", years: 3 },
  { label: "7년", years: 7 },
  { label: "11년", years: 11 },
  { label: "15년 이상", years: 15 },
];

/** 무주택기간 점수(최대 32점). 대표 연차만 받는 데모용 계산이다. */
export function calcHomelessScore(years: number): number {
  return Math.min(32, 2 * (Math.floor(years) + 1));
}

export type DependentsOption = { label: string; count: number };
export const DEPENDENTS_OPTIONS: DependentsOption[] = [
  { label: "0명", count: 0 },
  { label: "1명", count: 1 },
  { label: "2명", count: 2 },
  { label: "3명", count: 3 },
  { label: "4명", count: 4 },
  { label: "5명", count: 5 },
  { label: "6명 이상", count: 6 },
];

/** 부양가족수 점수(최대 35점). */
export function calcDependentsScore(count: number): number {
  return Math.min(35, 5 + 5 * count);
}

export type AccountYearsOption = { label: string; years: number };
export const ACCOUNT_YEARS_OPTIONS: AccountYearsOption[] = [
  { label: "6개월 미만", years: 0 },
  { label: "1년", years: 1 },
  { label: "5년", years: 5 },
  { label: "10년", years: 10 },
  { label: "15년 이상", years: 15 },
];

/** 청약통장 가입기간 점수(최대 17점). */
export function calcAccountScore(years: number): number {
  if (years < 0.5) return 1;
  if (years < 1) return 2;
  return Math.min(17, 2 + Math.floor(years));
}

export const SUBSCRIPTION_SCORE_MAX = 84;

export type SubscriptionScoreInput = {
  homelessYears: number;
  dependents: number;
  accountYears: number;
};

export type SubscriptionScoreResult = {
  homelessScore: number;
  dependentsScore: number;
  accountScore: number;
  total: number;
};

/** 3개 항목 점수를 합산한다. */
export function calcSubscriptionScore(
  input: SubscriptionScoreInput,
): SubscriptionScoreResult {
  const homelessScore = calcHomelessScore(input.homelessYears);
  const dependentsScore = calcDependentsScore(input.dependents);
  const accountScore = calcAccountScore(input.accountYears);
  return {
    homelessScore,
    dependentsScore,
    accountScore,
    total: homelessScore + dependentsScore + accountScore,
  };
}
