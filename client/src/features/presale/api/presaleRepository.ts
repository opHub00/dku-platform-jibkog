import { seedComplexes } from "../data/complexes";
import { seedListings } from "../data/listings";
import { isResaleRestricted } from "../lib/resale";
import type {
  Complex,
  NewPresaleListingInput,
  PresaleListing,
} from "../types";

/**
 * 분양권 데이터 저장소 인터페이스.
 * 화면은 이 인터페이스만 쓴다. DB가 붙으면 구현체만 바꾼다.
 */
export interface PresaleRepository {
  listComplexes(): Promise<Complex[]>;
  getComplex(id: string): Promise<Complex | null>;
  listListings(): Promise<PresaleListing[]>;
  getListing(id: number): Promise<PresaleListing | null>;
  createListing(input: NewPresaleListingInput): Promise<PresaleListing>;
  toggleLike(id: number): Promise<PresaleListing>;
  /** 매물이 바뀌면 listener를 호출한다. 반환값으로 구독을 해제한다. */
  subscribe(listener: () => void): () => void;
}

export class PresaleRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresaleRepositoryError";
  }
}

const STORAGE_KEY = "zipcok.presale.listings.v1";

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
      memory = clone(seedListings);
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

    async listListings() {
      const listings = [...load()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      return clone(listings);
    },

    async getListing(id) {
      const listing = load().find((l) => l.id === id);
      return listing ? clone(listing) : null;
    },

    async createListing(input) {
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
      const created: PresaleListing = {
        ...clone(input),
        id: nextId,
        status: "selling",
        liked: false,
        createdAt: new Date().toISOString(),
      };
      save([...listings, created]);
      return clone(created);
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
export const presaleRepository: PresaleRepository =
  createLocalStoragePresaleRepository();
