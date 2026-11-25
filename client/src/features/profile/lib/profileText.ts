import type { ProfileErrors, Region, UserProfile } from "../types";
import { NAME_MAX_LENGTH } from "../data/options";

const HANGUL_FULL_NAME = /^[가-힣]{3}$/;

/** 아바타·인사에 쓰는 짧은 이름. "주예나" → "예나", 그 밖에는 앞 두 글자 */
export function shortName(name: string): string {
  const trimmed = name.trim();
  if (HANGUL_FULL_NAME.test(trimmed)) return trimmed.slice(1);
  return trimmed.slice(0, 2);
}

/** 인사 문구용 이름. 세 글자 한글 이름은 성을 뺀다("예나님") */
export function greetingName(name: string): string {
  const trimmed = name.trim();
  return HANGUL_FULL_NAME.test(trimmed) ? trimmed.slice(1) : trimmed;
}

export function regionKey(region: Region): string {
  return `${region.sido} ${region.sigungu}`;
}

/** "서울 · 서초구", 여러 곳이면 "서울 · 서초구 외 2곳" */
export function interestHeadline(regions: Region[]): string {
  if (regions.length === 0) return "관심지역 없음";
  const [first] = regions;
  const head = `${first.sido} · ${first.sigungu}`;
  return regions.length > 1 ? `${head} 외 ${regions.length - 1}곳` : head;
}

/** MY 메뉴 설명. "서울 서초구 · 무주택 3년" */
export function profileSummary(profile: UserProfile): string {
  const residence = regionKey(profile.residence);
  return profile.homelessYears === null ? residence : `${residence} · 무주택 ${profile.homelessYears}년`;
}

export function validateProfile(profile: Omit<UserProfile, "savedAt">): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = profile.name.trim();
  if (name === "") errors.name = "이름을 적어주세요";
  else if (name.length > NAME_MAX_LENGTH) errors.name = `${NAME_MAX_LENGTH}자 이내로 적어주세요`;
  if (profile.residence.sido === "" || profile.residence.sigungu.trim() === "") {
    errors.residence = "사는 곳의 시도와 시군구를 알려주세요";
  }
  if (profile.age !== null && (profile.age < 14 || profile.age > 120)) errors.age = "14~120 사이로 적어주세요";
  if (profile.homelessYears !== null && profile.homelessYears > 80) errors.homelessYears = "80년 이하로 적어주세요";
  if (profile.interestRegions.length === 0) errors.interestRegions = "관심지역을 1곳 이상 골라주세요";
  if (profile.budgetMin !== null && profile.budgetMax !== null && profile.budgetMin > profile.budgetMax) {
    errors.budget = "최소 금액이 최대 금액보다 클 수 없어요";
  }
  return errors;
}
