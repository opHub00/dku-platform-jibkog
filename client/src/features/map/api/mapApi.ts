import { field } from "@/features/auth/api/httpClient";
import { NOTICE_STATUSES, type MapBounds, type MapMarker, type MapMarkersResponse } from "@/features/catalog/types";

/**
 * 지도 핀 저장소(GET /api/map/markers, docs/api-catalog.md).
 * 지도를 움직일 때마다 부르므로 이전 요청을 취소할 수 있게 signal을 받는다.
 */

/** 서버가 허용하는 최대 영역(도). 넘으면 가운데를 기준으로 줄여서 요청한다 */
const MAX_SPAN_DEG = 3;

export function clampBounds(b: MapBounds): MapBounds {
  const clampSpan = (lo: number, hi: number, min: number, max: number): [number, number] => {
    if (hi - lo <= MAX_SPAN_DEG) return [Math.max(min, lo), Math.min(max, hi)];
    const mid = (lo + hi) / 2;
    return [Math.max(min, mid - MAX_SPAN_DEG / 2 + 0.001), Math.min(max, mid + MAX_SPAN_DEG / 2 - 0.001)];
  };
  const [swLat, neLat] = clampSpan(b.swLat, b.neLat, -90, 90);
  const [swLng, neLng] = clampSpan(b.swLng, b.neLng, -180, 180);
  return { swLat, swLng, neLat, neLng };
}

function isMarker(value: unknown): value is MapMarker {
  const kind = field(value, "kind");
  const common = typeof field(value, "key") === "string" && typeof field(value, "lat") === "number" && typeof field(value, "lng") === "number" && typeof field(value, "title") === "string";
  if (!common) return false;
  if (kind === "listing") return typeof field(value, "listingId") === "number" && typeof field(value, "premiumWon") === "number";
  if (kind === "notice") return typeof field(value, "noticeId") === "string" && NOTICE_STATUSES.some((s) => s === field(value, "status"));
  return false;
}

export async function fetchMapMarkers(bounds: MapBounds, signal?: AbortSignal): Promise<MapMarkersResponse> {
  const b = clampBounds(bounds);
  const param = [b.swLat, b.swLng, b.neLat, b.neLng].map((v) => v.toFixed(6)).join(",");
  const response = await fetch(`/api/map/markers?bounds=${param}`, { credentials: "same-origin", signal });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("지도 핀을 불러오지 못했어요");
  const markers = field(json, "markers");
  if (!Array.isArray(markers)) throw new Error("지도 핀 형식이 올바르지 않아요");
  return { markers: markers.filter(isMarker), truncated: field(json, "truncated") === true };
}
