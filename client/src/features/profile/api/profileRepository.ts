import { DEFAULT_PROFILE } from "../data/options";
import type {
  AreaPreference,
  IncomeBracket,
  Region,
  SubscriptionPeriod,
  UserProfile,
} from "../types";

/**
 * 내 정보 저장소 인터페이스. 회원가입이 붙으면 구현체만 바꾼다.
 *
 * 민감 정보(소득 구간·나이·무주택 기간)는 이 저장소에만 둔다.
 * 지금 구현은 이 기기의 localStorage에만 저장하고 어떤 서버로도 보내지 않는다.
 */
export interface ProfileRepository {
  /** 저장된 값이 없으면 기본값을 돌려준다 */
  getProfile(): Promise<UserProfile>;
  saveProfile(profile: Omit<UserProfile, "savedAt">): Promise<UserProfile>;
  /** 값이 바뀌면 listener를 호출한다. 반환값으로 구독을 해제한다. */
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = "zipcok.profile.v1";

const INCOME_VALUES: readonly IncomeBracket[] = ["under30", "30to50", "50to70", "70to100", "over100"];
const SUBSCRIPTION_VALUES: readonly SubscriptionPeriod[] = ["under6m", "6mTo1y", "1to2y", "2to5y", "5to10y", "over10y"];
const AREA_VALUES: readonly AreaPreference[] = ["upTo59", "60to84", "over85"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRegion(value: unknown): Region | null {
  if (!isRecord(value) || typeof value.sido !== "string" || typeof value.sigungu !== "string") return null;
  return { sido: value.sido, sigungu: value.sigungu };
}

function nullableInt(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  return undefined;
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/** 저장값을 검증한다. 형식이 틀리면 null(기본값 사용) */
function parseProfile(value: unknown): UserProfile | null {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  const residence = parseRegion(value.residence);
  const age = nullableInt(value.age);
  const homelessYears = nullableInt(value.homelessYears);
  const budgetMin = nullableInt(value.budgetMin);
  const budgetMax = nullableInt(value.budgetMax);
  if (!residence || age === undefined || homelessYears === undefined || budgetMin === undefined || budgetMax === undefined) return null;
  if (!Array.isArray(value.interestRegions) || !Array.isArray(value.interestAreas)) return null;
  const interestRegions = value.interestRegions.map(parseRegion);
  if (interestRegions.some((r) => r === null)) return null;
  return {
    name: value.name,
    age,
    residence,
    homelessYears,
    incomeBracket: oneOf(INCOME_VALUES, value.incomeBracket) ? value.incomeBracket : null,
    subscriptionPeriod: oneOf(SUBSCRIPTION_VALUES, value.subscriptionPeriod) ? value.subscriptionPeriod : null,
    interestRegions: interestRegions.filter((r): r is Region => r !== null),
    interestAreas: value.interestAreas.filter((a): a is AreaPreference => oneOf(AREA_VALUES, a)),
    budgetMin,
    budgetMax,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : null,
  };
}

export function createLocalStorageProfileRepository(storageKey: string = STORAGE_KEY): ProfileRepository {
  const listeners = new Set<() => void>();

  function getStorage(): Storage | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  function emit(): void {
    listeners.forEach((listener) => listener());
  }

  function onStorage(event: StorageEvent): void {
    if (event.key === storageKey) emit();
  }

  return {
    async getProfile() {
      const storage = getStorage();
      if (storage) {
        try {
          const raw = storage.getItem(storageKey);
          if (raw !== null) {
            const parsed = parseProfile(JSON.parse(raw));
            if (parsed) return parsed;
          }
        } catch {
          // 깨진 값이면 기본값을 쓴다
        }
      }
      return structuredClone(DEFAULT_PROFILE);
    },

    async saveProfile(profile) {
      const saved: UserProfile = { ...structuredClone(profile), savedAt: new Date().toISOString() };
      const storage = getStorage();
      if (!storage) throw new Error("이 브라우저에서는 저장할 수 없어요");
      storage.setItem(storageKey, JSON.stringify(saved));
      emit();
      return structuredClone(saved);
    },

    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const profileRepository: ProfileRepository = createLocalStorageProfileRepository();
