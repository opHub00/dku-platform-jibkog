import { apiRequest, field } from "@/features/auth/api/httpClient";
import {
  CATALOG_REGIONS,
  NOTICE_STATUSES,
  type CatalogComplex,
  type CatalogComplexDetail,
  type CatalogComplexPage,
  type CatalogRegion,
  type HousingType,
  type LatLng,
  type Notice,
  type NoticeStatus,
} from "../types";

/**
 * 청약 카탈로그 저장소(docs/api-catalog.md).
 * 화면은 이 함수들만 쓴다. 지금은 서버 임시 응답(server/catalog/fixture.ts)을 받는다.
 */

export class CatalogFormatError extends Error {
  constructor(what: string) {
    super(`${what} 형식이 올바르지 않아요`);
    this.name = "CatalogFormatError";
  }
}

function str(value: unknown, key: string): string {
  const v = field(value, key);
  if (typeof v !== "string") throw new CatalogFormatError(key);
  return v;
}
function num(value: unknown, key: string): number {
  const v = field(value, key);
  if (typeof v !== "number" || !Number.isFinite(v)) throw new CatalogFormatError(key);
  return v;
}
function strOrNull(value: unknown, key: string): string | null {
  const v = field(value, key);
  return typeof v === "string" ? v : null;
}
function region(value: unknown): CatalogRegion {
  const v = str(value, "region");
  const found = CATALOG_REGIONS.find((r) => r === v);
  if (!found) throw new CatalogFormatError("region");
  return found;
}
function status(value: unknown, key: string): NoticeStatus {
  const v = str(value, key);
  const found = NOTICE_STATUSES.find((s) => s === v);
  if (!found) throw new CatalogFormatError(key);
  return found;
}
function location(value: unknown): LatLng | null {
  const v = field(value, "location");
  if (v === null || v === undefined) return null;
  return { lat: num(v, "lat"), lng: num(v, "lng") };
}
function list<T>(value: unknown, key: string, parse: (item: unknown) => T): T[] {
  const v = field(value, key);
  if (!Array.isArray(v)) throw new CatalogFormatError(key);
  return v.map(parse);
}

export function parseNotice(value: unknown): Notice {
  return {
    id: str(value, "id"),
    noticeNumber: str(value, "noticeNumber"),
    complexId: str(value, "complexId"),
    title: str(value, "title"),
    address: str(value, "address"),
    region: region(value),
    status: status(value, "status"),
    publishedOn: str(value, "publishedOn"),
    applicationsOpenOn: str(value, "applicationsOpenOn"),
    applicationsCloseOn: str(value, "applicationsCloseOn"),
    totalUnits: num(value, "totalUnits"),
    noticeUrl: str(value, "noticeUrl"),
    websiteUrl: strOrNull(value, "websiteUrl"),
    location: location(value),
  };
}

function parseHousingType(value: unknown): HousingType {
  return {
    modelNumber: str(value, "modelNumber"),
    housingTypeCode: str(value, "housingTypeCode"),
    exclusiveAreaM2: num(value, "exclusiveAreaM2"),
    supplyAreaM2: num(value, "supplyAreaM2"),
    maxPriceWon: num(value, "maxPriceWon"),
    generalUnits: num(value, "generalUnits"),
    specialUnits: num(value, "specialUnits"),
  };
}

function parseComplex(value: unknown): CatalogComplex {
  const range = field(value, "maxPriceRangeWon");
  return {
    id: str(value, "id"),
    name: str(value, "name"),
    address: str(value, "address"),
    region: region(value),
    sigungu: str(value, "sigungu"),
    location: location(value),
    moveInMonth: strOrNull(value, "moveInMonth"),
    totalUnits: num(value, "totalUnits"),
    latestNoticeId: str(value, "latestNoticeId"),
    latestNoticeStatus: status(value, "latestNoticeStatus"),
    maxPriceRangeWon: { min: num(range, "min"), max: num(range, "max") },
    housingTypeCount: num(value, "housingTypeCount"),
  };
}

function parseComplexDetail(value: unknown): CatalogComplexDetail {
  return {
    ...parseComplex(value),
    housingTypes: list(value, "housingTypes", parseHousingType),
    notices: list(value, "notices", parseNotice),
  };
}

export async function searchCatalogComplexes(query: { q?: string; region?: CatalogRegion; page?: number } = {}): Promise<CatalogComplexPage> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q.trim().slice(0, 50));
  if (query.region) params.set("region", query.region);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  const json = await apiRequest(`/api/catalog/complexes${qs ? `?${qs}` : ""}`);
  return {
    items: list(json, "items", parseComplex),
    page: num(json, "page"),
    pageSize: num(json, "pageSize"),
    total: num(json, "total"),
    hasNext: field(json, "hasNext") === true,
  };
}

export async function getCatalogComplex(id: string): Promise<CatalogComplexDetail> {
  const json = await apiRequest(`/api/catalog/complexes/${encodeURIComponent(id)}`);
  return parseComplexDetail(field(json, "complex"));
}

export async function listNotices(filter: { status?: NoticeStatus } = {}): Promise<Notice[]> {
  const json = await apiRequest(`/api/catalog/notices${filter.status ? `?status=${filter.status}` : ""}`);
  return list(json, "notices", parseNotice);
}
