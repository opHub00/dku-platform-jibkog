import type { Complex, DistrictSummary, PresaleListing } from "../types";
import { aggregateByDistrict } from "./aggregate";

export type GeoPoint = { lat: number; lng: number };

/** 지도 영역 안의 위치(%) */
export type MapPosition = { x: number; y: number };

/**
 * 지도 가장자리 여백(%). 위쪽은 지도 왼쪽 위 전환 버튼과 겹치지 않게 더 둔다.
 * 실제 지도가 아니라 상대 위치만 보여주는 도식 지도이므로 축별로 따로 늘린다.
 */
const INSET = { left: 14, right: 14, top: 24, bottom: 16 };

/**
 * 위도·경도 목록을 지도 영역 % 좌표로 바꾼다. 입력 순서대로 돌려준다.
 * 점이 하나뿐이거나 한 축의 범위가 0이면 그 축은 가운데에 둔다.
 */
export function projectToMap(points: GeoPoint[]): MapPosition[] {
  if (points.length === 0) return [];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const width = 100 - INSET.left - INSET.right;
  const height = 100 - INSET.top - INSET.bottom;

  return points.map((p) => ({
    x:
      maxLng === minLng
        ? INSET.left + width / 2
        : INSET.left + ((p.lng - minLng) / (maxLng - minLng)) * width,
    // 위도가 클수록 위쪽(북쪽)
    y:
      maxLat === minLat
        ? INSET.top + height / 2
        : INSET.top + ((maxLat - p.lat) / (maxLat - minLat)) * height,
  }));
}

export type MapBox = {
  width: number;
  height: number;
  /** 마커 중심이 가장자리에서 떨어져야 하는 최소 거리(px) */
  padding: { top: number; right: number; bottom: number; left: number };
};

/**
 * 가까운 마커끼리 minDistancePx 이상 떨어지도록 밀어낸다(단순 반복 완화).
 * 결과는 box 안쪽(padding 제외)으로 고정한다. 입력 순서대로 % 좌표를 돌려준다.
 */
export function spreadPositions(
  positions: MapPosition[],
  minDistancePx: number,
  box: MapBox,
): MapPosition[] {
  const { width, height, padding } = box;
  const minX = padding.left;
  const maxX = Math.max(minX, width - padding.right);
  const minY = padding.top;
  const maxY = Math.max(minY, height - padding.bottom);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const pts = positions.map((p) => ({
    x: clamp((p.x / 100) * width, minX, maxX),
    y: clamp((p.y / 100) * height, minY, maxY),
  }));

  for (let iteration = 0; iteration < 80; iteration++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistancePx) continue;
        if (distance < 0.01) {
          // 같은 자리면 순서에 따라 정해진 방향으로 벌린다
          const angle = (j * 2.4) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistancePx - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        pts[i].x = clamp(pts[i].x - ux * push, minX, maxX);
        pts[i].y = clamp(pts[i].y - uy * push, minY, maxY);
        pts[j].x = clamp(pts[j].x + ux * push, minX, maxX);
        pts[j].y = clamp(pts[j].y + uy * push, minY, maxY);
        moved = true;
      }
    }
    if (!moved) break;
  }

  return pts.map((p) => ({ x: (p.x / width) * 100, y: (p.y / height) * 100 }));
}

/** 시군구 식별자. 예: "서울 서초구" */
export function districtKey(sido: string, sigungu: string): string {
  return `${sido} ${sigungu}`;
}

export type DistrictMarker = DistrictSummary & {
  key: string;
  /** 시군구 안 단지 좌표의 평균 */
  center: GeoPoint;
};

/** 시군구별 거래 집계에 지도 중심 좌표를 붙인다. */
export function buildDistrictMarkers(
  listings: PresaleListing[],
  complexes: Complex[],
): DistrictMarker[] {
  const complexById = new Map(complexes.map((c) => [c.id, c]));
  const sums = new Map<string, { lat: number; lng: number; count: number }>();
  for (const listing of listings) {
    const complex = complexById.get(listing.complexId);
    if (!complex) continue;
    const key = districtKey(complex.sido, complex.sigungu);
    const sum = sums.get(key) ?? { lat: 0, lng: 0, count: 0 };
    sum.lat += complex.lat;
    sum.lng += complex.lng;
    sum.count += 1;
    sums.set(key, sum);
  }

  return aggregateByDistrict(listings, complexes).flatMap((summary) => {
    const key = districtKey(summary.sido, summary.sigungu);
    const sum = sums.get(key);
    if (!sum) return [];
    return [{ ...summary, key, center: { lat: sum.lat / sum.count, lng: sum.lng / sum.count } }];
  });
}
