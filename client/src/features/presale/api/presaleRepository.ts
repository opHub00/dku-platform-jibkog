import { attachSeedTrust } from "../ai/seedTrust";
import { seedComplexes } from "../data/complexes";
import { seedListings } from "../data/listings";
import { isResaleRestricted } from "../lib/resale";
import type {
  Complex,
  NewPresaleListingInput,
  PresaleListing,
  Seller,
  TrustReport,
} from "../types";
import type { AiResult, ContractExtraction, DescriptionScreening } from "../ai/types";
import { currentSeller } from "../data/currentSeller";
import { createHttpPresaleRepository } from "./httpPresaleRepository";

/** 이 점수 미만이면 등록 후 바로 노출하지 않고 검토 대기로 둔다 */
export const REVIEW_THRESHOLD_SCORE = 50;

/**
 * 분양권 데이터 저장소 인터페이스.
 * 화면은 이 인터페이스만 쓴다. DB가 붙으면 구현체만 바꾼다.
 */
export interface PresaleRepository {
  listComplexes(): Promise<Complex[]>;
  getComplex(id: string): Promise<Complex | null>;
  /** 기본으로 검토 대기(review) 매물은 빼고 돌려준다 */
  listListings(options?: { includeHidden?: boolean }): Promise<PresaleListing[]>;
  getListing(id: number): Promise<PresaleListing | null>;
  /** trust 점수가 REVIEW_THRESHOLD_SCORE 미만이면 status "review"로 저장한다 */
  createListing(
    input: NewPresaleListingInput,
    options?: { trust?: TrustReport; verification?: { contract: AiResult<ContractExtraction>; screening: AiResult<DescriptionScreening> } },
  ): Promise<PresaleListing>;
  /** 지금 로그인한 판매자(더미) */
  getCurrentSeller(): Promise<Seller>;
  toggleLike(id: number): Promise<PresaleListing>;
  /** 신뢰 검증 결과를 저장한다 */
  saveTrust(id: number, trust: TrustReport): Promise<PresaleListing>;
  /** 매물이 바뀌면 listener를 호출한다. 반환값으로 구독을 해제한다. */
  subscribe(listener: () => void): () => void;
}

export class PresaleRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresaleRepositoryError";
  }
}

// v2: 시드 매물에 신뢰 검증 결과(trust)를 붙이면서 키를 올렸다.
const STORAGE_KEY = "zipcok.presale.listings.v2";

function isPresaleListingArray(value: unknown): value is PresaleListing[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "number" &&
        "complexId" in item &&
        typeof item.complexId === "string",
    )
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createLocalStoragePresaleRepository(
  storageKey: string = STORAGE_KEY,
): PresaleRepository {
  const listeners = new Set<() => void>();
  let memory: PresaleListing[] | null = null;

  function getStorage(): Storage | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  function load(): PresaleListing[] {
    const storage = getStorage();
    if (storage) {
      try {
        const raw = storage.getItem(storageKey);
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (isPresaleListingArray(parsed)) {
            memory = parsed;
            return parsed;
          }
        }
      } catch {
        // 저장값이 깨졌거나 접근이 막혔으면 아래에서 시드로 다시 채운다.
      }
    }
    if (memory === null) {
      memory = attachSeedTrust(clone(seedListings), seedComplexes);
      save(memory, false);
    }
    return memory;
  }

  function save(listings: PresaleListing[], notify = true): void {
    memory = listings;
    const storage = getStorage();
    if (storage) {
      try {
        storage.setItem(storageKey, JSON.stringify(listings));
      } catch {
        // 용량 초과 등으로 저장이 실패해도 메모리 값으로 계속 동작한다.
      }
    }
    if (notify) emit();
  }

  function emit(): void {
    listeners.forEach((listener) => listener());
  }

  function onStorage(event: StorageEvent): void {
    if (event.key === storageKey) {
      memory = null;
      emit();
    }
  }

  function findComplex(id: string): Complex | undefined {
    return seedComplexes.find((c) => c.id === id);
  }

  return {
    async listComplexes() {
      return clone(seedComplexes);
    },

    async getComplex(id) {
      const complex = findComplex(id);
      return complex ? clone(complex) : null;
    },

    async listListings(options) {
      const listings = load()
        .filter((l) => options?.includeHidden || l.status !== "review")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return clone(listings);
    },

    async getCurrentSeller() {
      return clone(currentSeller);
    },

    async getListing(id) {
      const listing = load().find((l) => l.id === id);
      return listing ? clone(listing) : null;
    },

    async createListing(input, options) {
      const complex = findComplex(input.complexId);
      if (!complex) {
        throw new PresaleRepositoryError("단지 정보를 찾을 수 없어요");
      }
      if (isResaleRestricted(complex)) {
        throw new PresaleRepositoryError(
          "전매제한 기간이라 아직 등록할 수 없어요",
        );
      }

      const listings = load();
      const nextId = listings.reduce((max, l) => Math.max(max, l.id), 0) + 1;
      const trust = options?.trust;
      const created: PresaleListing = {
        ...clone(input),
        id: nextId,
        // 신뢰 점수가 기준 미만이면 검토 대기로 두고 목록에 노출하지 않는다.
        status:
          trust && trust.score < REVIEW_THRESHOLD_SCORE ? "review" : "selling",
        liked: false,
        createdAt: new Date().toISOString(),
        ...(trust ? { trust: clone(trust) } : {}),
      };
      save([...listings, created]);
      return clone(created);
    },

    async saveTrust(id, trust) {
      const listings = load();
      const target = listings.find((l) => l.id === id);
      if (!target) {
        throw new PresaleRepositoryError("매물을 찾을 수 없어요");
      }
      const updated: PresaleListing = { ...target, trust: clone(trust) };
      save(listings.map((l) => (l.id === id ? updated : l)));
      return clone(updated);
    },

    async toggleLike(id) {
      const listings = load();
      const target = listings.find((l) => l.id === id);
      if (!target) {
        throw new PresaleRepositoryError("매물을 찾을 수 없어요");
      }
      const updated: PresaleListing = { ...target, liked: !target.liked };
      save(listings.map((l) => (l.id === id ? updated : l)));
      return clone(updated);
    },

    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
  };
}

/** 앱 전체에서 쓰는 기본 저장소 */
/**
 * 앱 전체에서 쓰는 기본 저장소: 개발 서버 API(HTTP).
 * 서버 없이 화면만 볼 때는 createLocalStoragePresaleRepository()로 바꿀 수 있다.
 */
export const presaleRepository: PresaleRepository = createHttpPresaleRepository();
