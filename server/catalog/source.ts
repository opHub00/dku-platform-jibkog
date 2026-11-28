import type {
  CatalogComplexDetail,
  CatalogComplexPage,
  CatalogRegion,
  MapBounds,
  MapMarkersResponse,
  Notice,
  NoticeStatus,
} from "../../client/src/features/catalog/types";
import { CATALOG_REGIONS, NOTICE_STATUSES } from "../../client/src/features/catalog/types";
import { badRequest } from "../api/http";
import type { Store } from "../store/types";

/**
 * 카탈로그·지도 API의 서버 쪽 인터페이스(docs/api-catalog.md).
 * live.ts가 청약홈·카카오 수집 캐시를 연결한다. 키가 없으면 fixture.ts가 응답한다.
 */
export interface CatalogSource {
  searchComplexes(query: { q: string; region: CatalogRegion | null; page: number }): Promise<CatalogComplexPage>;
  /** 없으면 null(라우트가 404로 바꾼다) */
  getComplex(id: string): Promise<CatalogComplexDetail | null>;
  listNotices(query: { status: NoticeStatus | null }): Promise<Notice[]>;
  /** 분양권 매물 핀은 store에서, 공고 핀은 카탈로그에서 */
  /** recentDays를 주면 마감 후 그 일수가 지난 공고 핀은 뺀다(null이면 모두) */
  mapMarkers(store: Store, bounds: MapBounds, options?: { recentDays: number | null }): Promise<MapMarkersResponse>;
}

// ---------------------------------------------------------------- 쿼리 파싱(약속의 일부)

export function parseComplexQuery(params: URLSearchParams): { q: string; region: CatalogRegion | null; page: number } {
  const q = (params.get("q") ?? "").trim();
  if (q.length > 50) throw badRequest("q는 50자 이하로 보내주세요");
  const rawRegion = params.get("region");
  let region: CatalogRegion | null = null;
  if (rawRegion !== null && rawRegion !== "") {
    region = CATALOG_REGIONS.find((r) => r === rawRegion) ?? null;
    if (!region) throw badRequest("region이 올바르지 않아요");
  }
  const rawPage = params.get("page");
  const page = rawPage === null || rawPage === "" ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw badRequest("page는 1 이상의 정수예요");
  return { q, region, page };
}

export function parseNoticeQuery(params: URLSearchParams): { status: NoticeStatus | null } {
  const raw = params.get("status");
  if (raw === null || raw === "") return { status: null };
  const status = NOTICE_STATUSES.find((s) => s === raw);
  if (!status) throw badRequest("status는 open, upcoming, closed 중 하나예요");
  return { status };
}

/** 한 번에 볼 수 있는 지도 영역 한도(도). 대략 수도권 전체 정도 */
const MAX_SPAN_DEG = 3;

export function parseBounds(params: URLSearchParams): MapBounds {
  const parts = (params.get("bounds") ?? "").split(",").map((v) => Number(v.trim()));
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) throw badRequest("bounds는 swLat,swLng,neLat,neLng 숫자 4개예요");
  const [swLat, swLng, neLat, neLng] = parts as [number, number, number, number];
  if (swLat < -90 || neLat > 90 || swLng < -180 || neLng > 180) throw badRequest("bounds 좌표 범위가 올바르지 않아요");
  if (!(swLat < neLat && swLng < neLng)) throw badRequest("bounds는 남서쪽 좌표가 북동쪽보다 작아야 해요");
  if (neLat - swLat > MAX_SPAN_DEG || neLng - swLng > MAX_SPAN_DEG) throw badRequest("지도 영역이 너무 넓어요. 확대해서 다시 요청해주세요");
  return { swLat, swLng, neLat, neLng };
}

/** 선택 쿼리 recentDays(0~3650 정수). 없으면 null */
export function parseRecentDays(params: URLSearchParams): number | null {
  const raw = params.get("recentDays");
  if (raw === null || raw === "") return null;
  const days = Number(raw);
  if (!Number.isSafeInteger(days) || days < 0 || days > 3650) throw badRequest("recentDays는 0~3650 사이 정수예요");
  return days;
}

export function inBounds(b: MapBounds, lat: number, lng: number): boolean {
  return lat >= b.swLat && lat <= b.neLat && lng >= b.swLng && lng <= b.neLng;
}
