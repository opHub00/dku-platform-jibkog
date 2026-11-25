import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Layers, MapPin } from "lucide-react";
import { StatusPill } from "@/components/common/StatusPill";
import type { MapBounds, MapMarker } from "@/features/catalog/types";
import { formatWonShort } from "@/features/presale/lib/format";
import { fetchMapMarkers } from "../api/mapApi";
import { CLUSTER_LEVEL, clusterByDistrict, regionBubbleSize, spreadPins, type ToPixel } from "../lib/cluster";
import { kakaoMapKey, loadKakaoMaps } from "../lib/loadKakaoMaps";
import "@/features/presale/presale.css";
import "../map.css";

export type MapMode = "pins" | "regions";

/** 처음 보여줄 곳: 서울 중심, 시내 전체가 보이는 레벨 */
const INITIAL_CENTER = { lat: 37.5465, lng: 126.99 };
const INITIAL_LEVEL = 9;
/** 서버가 받는 최대 영역(3도)을 넘지 않는 가장 넓은 레벨 */
const MAX_LEVEL = 12;
/** 지역 원·지역 칩을 누르면 이 레벨로 들어간다 */
const FOCUS_LEVEL = CLUSTER_LEVEL - 2;
const IDLE_DEBOUNCE_MS = 200;

/** 마지막으로 멈춘 지도 화면(핀 겹침 계산용) */
type View = { bounds: MapBounds; width: number; height: number; level: number };

/** 화면 안에서는 위도·경도를 px로 직선 변환해도 겹침 판단에 충분하다 */
function pixelProjector(view: View): ToPixel {
  const { bounds: b, width, height } = view;
  const lngSpan = b.neLng - b.swLng || 1;
  const latSpan = b.neLat - b.swLat || 1;
  return (lat, lng) => ({ x: ((lng - b.swLng) / lngSpan) * width, y: ((b.neLat - lat) / latSpan) * height });
}

function boundsOf(map: kakao.maps.Map): MapBounds {
  const b = map.getBounds();
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  return { swLat: sw.getLat(), swLng: sw.getLng(), neLat: ne.getLat(), neLng: ne.getLng() };
}

/** 카카오 커스텀 오버레이 안에 React 요소를 그린다 */
function Overlay({ map, lat, lng, zIndex, children }: { map: kakao.maps.Map; lat: number; lng: number; zIndex: number; children: ReactNode }) {
  const element = useMemo(() => {
    const div = document.createElement("div");
    div.className = "km-overlay";
    return div;
  }, []);
  // 처음 값으로 한 번만 만들고, 위치·zIndex는 아래 effect에서 바꾼다
  const [overlay] = useState(
    () => new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(lat, lng), content: element, clickable: true, xAnchor: 0, yAnchor: 0, zIndex }),
  );
  useEffect(() => {
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [overlay, map]);
  useEffect(() => overlay.setPosition(new kakao.maps.LatLng(lat, lng)), [overlay, lat, lng]);
  useEffect(() => overlay.setZIndex(zIndex), [overlay, zIndex]);
  return createPortal(children, element);
}

export function KakaoMap({
  mode,
  onModeChange,
  filter,
  districtOf,
  pinPrice,
  onOpenMarker,
  onVisibleChange,
  focus,
  fallback,
}: {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  /** 매물 탭 필터(전체/청약공고/분양권거래, 지역 칩)에 맞는 핀만 보여준다 */
  filter: (marker: MapMarker) => boolean;
  /** 핀의 시군구("서울 영등포구"). 지역 원으로 묶을 때 쓴다 */
  districtOf: (marker: MapMarker) => string | null;
  /** 거래 핀에 보여줄 짧은 가격. 없으면 프리미엄을 보여준다 */
  pinPrice: (marker: Extract<MapMarker, { kind: "listing" }>) => string | null;
  onOpenMarker: (marker: MapMarker) => void;
  /** 지금 화면 안에 보이는 핀(필터 적용 후) */
  onVisibleChange?: (markers: MapMarker[]) => void;
  /** 지역 칩을 고르면 그 지역 중심으로 옮긴다 */
  focus?: { lat: number; lng: number } | null;
  /** 키가 없거나 SDK를 못 불러오면 대신 보여줄 화면(기존 그림 지도) */
  fallback: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);
  const [failed, setFailed] = useState(() => kakaoMapKey() === null);
  const [view, setView] = useState<View | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // SDK 로딩과 지도 생성
  useEffect(() => {
    if (failed) return;
    let active = true;
    loadKakaoMaps()
      .then((maps) => {
        const host = hostRef.current;
        if (!active || !host) return;
        const created = new maps.Map(host, { center: new maps.LatLng(INITIAL_CENTER.lat, INITIAL_CENTER.lng), level: INITIAL_LEVEL });
        created.setMaxLevel(MAX_LEVEL);
        setMap(created);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [failed]);

  // 지도를 움직이면(idle) 범위 안 핀을 다시 불러온다
  useEffect(() => {
    if (!map) return;
    let timer = 0;
    let controller: AbortController | null = null;
    const reload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        controller?.abort();
        const current = new AbortController();
        controller = current;
        const bounds = boundsOf(map);
        const host = hostRef.current;
        setView({ bounds, width: host?.clientWidth ?? 0, height: host?.clientHeight ?? 0, level: map.getLevel() });
        fetchMapMarkers(bounds, current.signal)
          .then((result) => {
            if (current.signal.aborted) return;
            setMarkers(result.markers);
            setTruncated(result.truncated);
            setFetchError(false);
          })
          .catch(() => {
            if (!current.signal.aborted) setFetchError(true);
          });
      }, IDLE_DEBOUNCE_MS);
    };
    kakao.maps.event.addListener(map, "idle", reload);
    reload();
    return () => {
      kakao.maps.event.removeListener(map, "idle", reload);
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [map]);

  // 화면 크기가 바뀌면 지도 타일을 다시 맞춘다
  useEffect(() => {
    const host = hostRef.current;
    if (!map || !host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.relayout());
    observer.observe(host);
    return () => observer.disconnect();
  }, [map]);

  useEffect(() => {
    if (!map || !focus) return;
    map.setLevel(Math.min(map.getLevel(), FOCUS_LEVEL));
    map.panTo(new kakao.maps.LatLng(focus.lat, focus.lng));
  }, [map, focus]);

  const visible = useMemo(() => markers.filter(filter), [markers, filter]);
  useEffect(() => {
    if (map) onVisibleChange?.(visible);
  }, [map, visible, onVisibleChange]);

  const clustered = mode === "regions" || (view?.level ?? INITIAL_LEVEL) >= CLUSTER_LEVEL;
  const toPixel = useMemo(() => (view ? pixelProjector(view) : null), [view]);
  const clusters = useMemo(() => (clustered && toPixel ? clusterByDistrict(visible, districtOf, toPixel) : []), [clustered, visible, districtOf, toPixel]);
  const offsets = useMemo(() => (!clustered && toPixel ? spreadPins(visible, toPixel) : new Map<string, { dx: number; dy: number }>()), [clustered, visible, toPixel]);

  if (failed) return <>{fallback}</>;

  const zoomInto = (lat: number, lng: number) => {
    if (!map) return;
    if (mode === "regions") onModeChange("pins");
    const target = new kakao.maps.LatLng(lat, lng);
    map.setLevel(Math.min(map.getLevel() - 1, FOCUS_LEVEL), { anchor: target });
    map.panTo(target);
  };

  return (
    <div className="map-canvas km-canvas">
      <div className="km-host" ref={hostRef} />
      <div className="view-toggle ps-map-toggle"><button className={mode === "pins" ? "active" : ""} onClick={() => onModeChange("pins")}><MapPin size={13} />매물</button><button className={mode === "regions" ? "active" : ""} onClick={() => onModeChange("regions")}><Layers size={13} />지역별 거래</button></div>
      {map && !clustered && visible.map((marker) => {
        const offset = offsets.get(marker.key) ?? { dx: 0, dy: 0 };
        const style = { left: offset.dx, top: offset.dy };
        if (marker.kind === "listing") {
          const price = pinPrice(marker) ?? formatWonShort(marker.premiumWon);
          return (
            <Overlay key={marker.key} map={map} lat={marker.lat} lng={marker.lng} zIndex={2}>
              <button className="map-pin trade-pin" style={style} onClick={() => onOpenMarker(marker)} aria-label={`${marker.title} ${marker.areaM2}㎡ 분양권 거래${marker.isDemo ? ", 시연용 예시 매물" : ""}`}>
                {marker.isDemo && <span className="km-demo-pill"><StatusPill tone="sand">예시</StatusPill></span>}
                <span>거래</span><b>{price}</b>
              </button>
            </Overlay>
          );
        }
        return (
          <Overlay key={marker.key} map={map} lat={marker.lat} lng={marker.lng} zIndex={1}>
            <button className="map-pin notice-pin" style={style} onClick={() => onOpenMarker(marker)} aria-label={`${marker.title} 청약공고`}>
              <span>청약</span><b>공고</b>
            </button>
          </Overlay>
        );
      })}
      {map && clustered && clusters.map((cluster) => {
        const size = regionBubbleSize(cluster.count);
        return (
          <Overlay key={`${cluster.key}-${cluster.markers[0]?.key ?? ""}`} map={map} lat={cluster.lat} lng={cluster.lng} zIndex={3}>
            <button className="ps-region-bubble" style={{ left: 0, top: 0, width: size, height: size }} onClick={() => zoomInto(cluster.lat, cluster.lng)} aria-label={`${cluster.key} 매물·공고 ${cluster.count}건 확대해서 보기`}>
              <span>{cluster.key}</span><b>· {cluster.count}건</b>
            </button>
          </Overlay>
        );
      })}
      {(!map || truncated || fetchError || visible.length === 0) && (
        <div className="map-scale km-status">
          {!map ? "지도를 불러오는 중이에요" : fetchError ? "핀을 불러오지 못했어요. 지도를 움직여 다시 시도해주세요" : truncated ? "지도를 확대하면 더 보여요" : "이 지역에는 보여줄 매물이 없어요"}
        </div>
      )}
    </div>
  );
}
