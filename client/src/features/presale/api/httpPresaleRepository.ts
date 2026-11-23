import { ApiRequestError, apiRequest, AuthRequiredError, field } from "@/features/auth/api/httpClient";
import { getAuthState, refreshAuth } from "@/features/auth/lib/session";
import { onServerEvent } from "@/features/auth/lib/serverEvents";
import type { Complex, PresaleDocument, PresaleListing, PresaleListingStatus, Seller, Sido, TrustReport } from "../types";
import { PresaleRepositoryError, type PresaleRepository } from "./presaleRepository";

/**
 * 분양권 저장소의 HTTP 구현체(개발 서버 API, docs/api.md).
 * 매물·단지·찜·신뢰 리포트를 서버에 저장해 다른 기기·계정과 공유한다.
 */

const STATUSES: readonly PresaleListingStatus[] = ["selling", "reserved", "sold", "review"];
const SIDOS: readonly Sido[] = ["서울", "경기", "인천"];

function num(value: unknown, key: string): number {
  const v = field(value, key);
  if (typeof v !== "number") throw new PresaleRepositoryError(`${key} 형식 오류`);
  return v;
}
function str(value: unknown, key: string): string {
  const v = field(value, key);
  if (typeof v !== "string") throw new PresaleRepositoryError(`${key} 형식 오류`);
  return v;
}

function parseComplex(value: unknown): Complex {
  const sido = str(value, "sido");
  const areas = field(value, "supplyAreas");
  const restriction = field(value, "resaleRestrictionEndsOn");
  if (!(SIDOS as readonly string[]).includes(sido) || !Array.isArray(areas)) throw new PresaleRepositoryError("단지 형식 오류");
  return {
    id: str(value, "id"),
    name: str(value, "name"),
    address: str(value, "address"),
    sido: sido as Sido,
    sigungu: str(value, "sigungu"),
    lat: num(value, "lat"),
    lng: num(value, "lng"),
    moveInMonth: str(value, "moveInMonth"),
    resaleRestrictionEndsOn: typeof restriction === "string" ? restriction : null,
    supplyAreas: areas.filter((a): a is number => typeof a === "number"),
    referencePremiumRate: num(value, "referencePremiumRate"),
    image: str(value, "image"),
  };
}

function isTrustReport(value: unknown): value is TrustReport {
  return typeof field(value, "score") === "number" && typeof field(value, "grade") === "string" && Array.isArray(field(value, "items"));
}

function parseListing(value: unknown): PresaleListing {
  const seller = field(value, "seller");
  const status = str(value, "status");
  const documents = field(value, "documents");
  const trust = field(value, "trust");
  if (!(STATUSES as readonly string[]).includes(status) || !Array.isArray(documents)) throw new PresaleRepositoryError("매물 형식 오류");
  const parsedSeller: Seller = {
    id: num(seller, "id"),
    nickname: str(seller, "nickname"),
    realName: str(seller, "realName"),
    identityVerified: field(seller, "identityVerified") === true,
    tradeCount: num(seller, "tradeCount"),
  };
  return {
    id: num(value, "id"),
    complexId: str(value, "complexId"),
    seller: parsedSeller,
    area: num(value, "area"),
    floor: num(value, "floor"),
    salePrice: num(value, "salePrice"),
    premium: num(value, "premium"),
    optionCost: num(value, "optionCost"),
    paidAmount: num(value, "paidAmount"),
    description: str(value, "description"),
    documents: documents.map((d): PresaleDocument => ({
      type: str(d, "type") as PresaleDocument["type"],
      status: str(d, "status") as PresaleDocument["status"],
    })),
    status: status as PresaleListingStatus,
    liked: field(value, "liked") === true,
    createdAt: str(value, "createdAt"),
    ...(isTrustReport(trust) ? { trust } : {}),
    isMine: field(value, "isMine") === true,
  };
}

function listOf<T>(value: unknown, key: string, parse: (item: unknown) => T): T[] {
  const items = field(value, key);
  if (!Array.isArray(items)) throw new PresaleRepositoryError(`${key} 형식 오류`);
  return items.map(parse);
}

export function createHttpPresaleRepository(): PresaleRepository {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  let complexesCache: Promise<Complex[]> | null = null;
  let unsubscribeServer: (() => void) | null = null;

  const listComplexes = () => {
    complexesCache ??= apiRequest("/api/complexes")
      .then((json) => listOf(json, "complexes", parseComplex))
      .catch((error: unknown) => {
        complexesCache = null;
        throw error;
      });
    return complexesCache;
  };

  const getListing = async (id: number) => {
    try {
      return parseListing(field(await apiRequest(`/api/listings/${id}`), "listing"));
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  };

  return {
    listComplexes,
    async getComplex(id) {
      return (await listComplexes()).find((c) => c.id === id) ?? null;
    },
    async listListings(options) {
      const listings = listOf(await apiRequest("/api/listings"), "listings", parseListing);
      // 서버는 내 검토 대기 매물도 준다. 공개 목록에서는 뺀다.
      return options?.includeHidden ? listings : listings.filter((l) => l.status !== "review");
    },
    getListing,
    async createListing(input, options) {
      // 판매자는 서버가 로그인 정보로 정한다(본문의 seller는 보내지 않는다)
      const { seller: _seller, ...rest } = input;
      const json = await apiRequest("/api/listings", { method: "POST", body: { ...rest, ...(options?.trust ? { trust: options.trust } : {}) } });
      emit();
      return parseListing(field(json, "listing"));
    },
    async getCurrentSeller() {
      if (!getAuthState().loaded) await refreshAuth();
      const user = getAuthState().user;
      if (!user) throw new AuthRequiredError();
      return { id: user.id, nickname: user.nickname, realName: user.realName ?? user.nickname, identityVerified: user.identityVerified, tradeCount: 0 };
    },
    async toggleLike(id) {
      const current = await getListing(id);
      if (!current) throw new PresaleRepositoryError("매물을 찾을 수 없어요");
      await apiRequest(`/api/listings/${id}/favorite`, { method: "PUT", body: { liked: !current.liked } });
      emit();
      return { ...current, liked: !current.liked };
    },
    async saveTrust() {
      throw new PresaleRepositoryError("서버 저장소에서는 매물 등록 때만 신뢰 리포트를 저장해요");
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!unsubscribeServer) {
        const offListing = onServerEvent("listing.changed", emit);
        const offResync = onServerEvent("resync", emit);
        unsubscribeServer = () => {
          offListing();
          offResync();
        };
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && unsubscribeServer) {
          unsubscribeServer();
          unsubscribeServer = null;
        }
      };
    },
  };
}
