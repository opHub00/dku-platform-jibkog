import type { MapMarker } from "@/features/catalog/types";

/** 지도를 이 레벨 이상으로 줄이면(넓게 보면) 핀 대신 지역 원으로 묶는다(카카오 레벨: 숫자가 클수록 넓다) */
export const CLUSTER_LEVEL = 10;

/** 위도·경도 → 지도 안 px 좌표 */
export type ToPixel = (lat: number, lng: number) => { x: number; y: number };

export type RegionCluster = {
  /** 원 안에 쓰는 이름. 예: "서울 영등포구", 여러 구가 합쳐지면 "서울" */
  key: string;
  lat: number;
  lng: number;
  count: number;
  markers: MapMarker[];
};

/** 원 지름(기존 그림 지도와 같은 규칙) */
export function regionBubbleSize(count: number): number {
  return Math.min(96, 72 + (count - 1) * 8);
}

function mergedName(names: string[]): string {
  const sidos = [...new Set(names.map((name) => name.split(" ")[0]))];
  if (names.length === 1) return names[0];
  return sidos.length === 1 ? sidos[0] : `${sidos[0]} 주변`;
}

/**
 * 핀을 시군구별로 묶고, 화면에서 서로 겹치는 원은 하나로 합친다.
 * 같은 시·도끼리 합쳐지면 "서울", 시·도가 섞이면 "서울 주변"처럼 보여준다.
 */
export function clusterByDistrict(markers: MapMarker[], districtOf: (marker: MapMarker) => string | null, toPixel: ToPixel): RegionCluster[] {
  type Group = { names: string[]; markers: MapMarker[]; lat: number; lng: number };
  const byDistrict = new Map<string, MapMarker[]>();
  for (const marker of markers) {
    const key = districtOf(marker) ?? "주변";
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), marker]);
  }
  const center = (group: MapMarker[]) => ({
    lat: group.reduce((sum, m) => sum + m.lat, 0) / group.length,
    lng: group.reduce((sum, m) => sum + m.lng, 0) / group.length,
  });
  let groups: Group[] = [...byDistrict.entries()].map(([name, group]) => ({ names: [name], markers: group, ...center(group) }));

  // 겹치는 원을 가장 가까운 쌍부터 합친다
  for (;;) {
    let best: { i: number; j: number; distance: number } | null = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = toPixel(groups[i].lat, groups[i].lng);
        const b = toPixel(groups[j].lat, groups[j].lng);
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const minDistance = (regionBubbleSize(groups[i].markers.length) + regionBubbleSize(groups[j].markers.length)) / 2 + 4;
        if (distance < minDistance && (!best || distance < best.distance)) best = { i, j, distance };
      }
    }
    if (!best) break;
    const a = groups[best.i];
    const b = groups[best.j];
    const merged = [...a.markers, ...b.markers];
    groups = groups.filter((_, index) => index !== best.i && index !== best.j);
    groups.push({ names: [...a.names, ...b.names], markers: merged, ...center(merged) });
  }

  return groups.map((group) => ({ key: mergedName(group.names), lat: group.lat, lng: group.lng, count: group.markers.length, markers: group.markers }));
}

/**
 * 가까운 핀끼리 겹치지 않게 화면에서 조금씩 벌린다(기존 그림 지도의 spreadPositions와 같은 방식, px 단위).
 * 같은 좌표(같은 단지)의 핀은 정해진 방향으로 펼친다.
 */
export function spreadPins(markers: MapMarker[], toPixel: ToPixel, minDistance = 48): Map<string, { dx: number; dy: number }> {
  const origin = markers.map((m) => toPixel(m.lat, m.lng));
  const pts = origin.map((p) => ({ ...p }));
  for (let iteration = 0; iteration < 40; iteration++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance < 0.01) {
          const angle = (j * 2.4) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }
        const push = (minDistance - distance) / 2;
        pts[i].x -= (dx / distance) * push;
        pts[i].y -= (dy / distance) * push;
        pts[j].x += (dx / distance) * push;
        pts[j].y += (dy / distance) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(markers.map((m, i) => [m.key, { dx: pts[i].x - origin[i].x, dy: pts[i].y - origin[i].y }]));
}
