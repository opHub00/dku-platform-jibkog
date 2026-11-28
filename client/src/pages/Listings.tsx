import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Layers, Map as MapIcon, MapPin, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Listing, ListingType } from "@/types";
import { ListingCard } from "@/components/common/ListingCard";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { toListing } from "@/features/presale/lib/toListing";
import { formatWonShort } from "@/features/presale/lib/format";
import { buildDistrictMarkers, districtKey, projectToMap, spreadPositions, type DistrictMarker, type MapObstacle, type MapPosition } from "@/features/presale/lib/mapProjection";
import type { Complex } from "@/features/presale/types";
import type { MapMarker } from "@/features/catalog/types";
import { useNotices } from "@/features/catalog/lib/useNotices";
import { noticeToListing } from "@/features/catalog/lib/noticeText";
import { isCurrentNotice, isCurrentStatus, matchesRegion } from "@/features/catalog/lib/noticeFilter";
import { StatusPill } from "@/components/common/StatusPill";
import { KakaoMap } from "@/features/map/components/KakaoMap";
import { groupByArea, type AreaBubble } from "@/features/map/lib/cluster";
import "@/features/presale/presale.css";
import { useProfile } from "@/features/profile/lib/useProfile";
import { interestHeadline } from "@/features/profile/lib/profileText";

type ViewMode = "map" | "list";

type MapMode = "pins" | "regions";

/** 좌표가 없는 매물용 기존 고정 위치 */
const FALLBACK_PIN_POSITIONS = [
  { left: "19%", top: "26%" },
  { left: "56%", top: "21%" },
  { left: "72%", top: "55%" },
  { left: "36%", top: "68%" },
];

/** 측정 전 기본 지도 크기(430px 화면 기준) */
const DEFAULT_MAP_SIZE = { width: 390, height: 344 };
/** 왼쪽 위 전환 버튼과 오른쪽 아래 축척 표시를 피하는 여백(px) */
const TOGGLE_SPACE = 44;
const SCALE_SPACE = 34;
const PIN_HALF = { width: 32, height: 24 };
const PIN_MIN_DISTANCE = 52;
/** 그림 지도에 핀으로 바로 놓는 최대 개수. 넘으면 지역 원으로 묶는다 */
const MAX_FALLBACK_PINS = 12;
/** index.css .map-current: left 49%, top 52%, 22px 원. 핀·원이 이 점을 가리지 않게 피한다 */
const CURRENT_DOT = { left: 0.49, top: 0.52, size: 22 };
/** 핀 중심에서 꼬리 끝까지의 대략 반경 + 여유 */
const PIN_RADIUS = 30;

function currentDotObstacle(size: { width: number; height: number }, markerRadius: number): MapObstacle {
  const half = CURRENT_DOT.size / 2;
  return {
    x: size.width * CURRENT_DOT.left + half,
    y: size.height * CURRENT_DOT.top + half,
    radius: markerRadius + half + 4,
  };
}

function regionBubbleSize(count: number): number {
  return Math.min(96, 72 + (count - 1) * 8);
}

function toStyle(position: MapPosition) {
  return { left: `${position.x}%`, top: `${position.y}%` };
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(DEFAULT_MAP_SIZE);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function MapCanvas({
  filteredListings,
  onOpenListing,
  mode,
  onModeChange,
  regions,
  onSelectRegion,
  regionFilter,
}: {
  filteredListings: Listing[];
  onOpenListing: (listing: Listing) => void;
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  regions: DistrictMarker[];
  onSelectRegion: (key: string) => void;
  /** 고른 지역("서울" 또는 "서울 영등포구") */
  regionFilter: string | null;
}) {
  const located = filteredListings.filter(
    (listing): listing is Listing & { lat: number; lng: number } =>
      listing.lat !== undefined && listing.lng !== undefined,
  );
  const [canvasRef, size] = useElementSize<HTMLDivElement>();
  // 실제 데이터는 핀이 수십 개라 그림 지도에 다 놓으면 겹친다. 시군구를 고르기 전에는 지역 원으로 묶는다
  const districtChosen = regionFilter !== null && regionFilter.includes(" ");
  const autoAreas = mode === "pins" && !districtChosen && located.length > MAX_FALLBACK_PINS
    ? groupByArea(located, regionFilter === null ? "auto" : "district")
    : null;
  const bubbles: AreaBubble[] = mode === "regions" ? regions : autoAreas ?? [];
  const pinPositions = autoAreas ? [] : spreadPositions(projectToMap(located), PIN_MIN_DISTANCE, {
    ...size,
    padding: {
      top: TOGGLE_SPACE + PIN_HALF.height,
      right: PIN_HALF.width,
      bottom: SCALE_SPACE + PIN_HALF.height,
      left: PIN_HALF.width,
    },
  }, [currentDotObstacle(size, PIN_RADIUS)]);
  const pinPositionByKey = new Map(
    located.map((listing, index) => [`${listing.type}-${listing.id}`, pinPositions[index]]),
  );
  const largestBubble = Math.max(0, ...bubbles.map((region) => regionBubbleSize(region.listingCount)));
  const bubbleHalf = largestBubble / 2 + 6;
  const regionPositions = spreadPositions(
    projectToMap(bubbles.map((region) => region.center)),
    largestBubble + 6,
    {
      ...size,
      padding: { top: TOGGLE_SPACE + bubbleHalf, right: bubbleHalf, bottom: SCALE_SPACE + bubbleHalf, left: bubbleHalf },
    },
    [currentDotObstacle(size, largestBubble / 2)],
  );
  return (
    <div className="map-canvas" ref={canvasRef}>
      <div className="map-grid" />
      <div className="map-water water-one" /><div className="map-water water-two" />
      <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
      <div className="map-label label-one">반포대로</div><div className="map-label label-two">잠원동</div><div className="map-label label-three">고속터미널</div><div className="map-label label-four">서초</div>
      <div className="view-toggle ps-map-toggle"><button className={mode === "pins" ? "active" : ""} onClick={() => onModeChange("pins")}><MapPin size={13} />매물</button><button className={mode === "regions" ? "active" : ""} onClick={() => onModeChange("regions")}><Layers size={13} />지역별 거래</button></div>
      {mode === "pins" && !autoAreas && filteredListings.map((listing, index) => {
        const projected = pinPositionByKey.get(`${listing.type}-${listing.id}`);
        const position = projected ? toStyle(projected) : FALLBACK_PIN_POSITIONS[index % FALLBACK_PIN_POSITIONS.length];
        return <button key={`${listing.type}-${listing.id}`} className={`map-pin ${listing.type === "trade" ? "trade-pin" : "notice-pin"}`} style={position} onClick={() => onOpenListing(listing)} aria-label={listing.presale?.isDemo ? `${listing.title} 시연용 예시 매물` : undefined}>{listing.presale?.isDemo && <span className="km-demo-pill"><StatusPill tone="sand">예시</StatusPill></span>}<span>{listing.type === "trade" ? "거래" : "청약"}</span><b>{listing.type === "trade" ? listing.price.split(" ")[0] : "공고"}</b></button>;
      })}
      {(mode === "regions" || autoAreas) && bubbles.map((region, index) => {
        const size = regionBubbleSize(region.listingCount);
        return <button key={region.key} className="ps-region-bubble" style={{ ...toStyle(regionPositions[index]), width: size, height: size }} onClick={() => onSelectRegion(region.key)} aria-label={`${region.key} ${mode === "regions" ? "분양권 거래" : "매물·공고"} ${region.listingCount}건 보기`}><span>{region.key}</span><b>· {region.listingCount}건</b></button>;
      })}
      <div className="map-current"><span /></div>
      <div className="map-scale">현재 위치 기준 · 1.2km</div>
    </div>
  );
}

export function ListingsView({ onOpenListing }: { onOpenListing: (listing: Listing) => void }) {
  const profile = useProfile();
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [filter, setFilter] = useState<"all" | ListingType>("all");
  const [tradeListings, setTradeListings] = useState<Listing[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>("pins");
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [regions, setRegions] = useState<DistrictMarker[]>([]);
  const [complexes, setComplexes] = useState<Complex[]>([]);
  /** 카카오 지도 화면 안에 보이는 핀. 그림 지도(대체 화면)면 null */
  const [visibleMarkers, setVisibleMarkers] = useState<MapMarker[] | null>(null);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);
  const notices = useNotices();
  // 접수 중·예정·최근 마감 공고만(지난 공고는 단지 검색·상세로 본다)
  const noticeListings = useMemo(() => (notices ?? []).filter((notice) => isCurrentNotice(notice)).map((notice) => noticeToListing(notice)), [notices]);

  useEffect(() => {
    let active = true;
    Promise.all([
      presaleRepository.listListings(),
      presaleRepository.listComplexes(),
    ]).then(([presaleListings, complexes]) => {
      if (!active) return;
      setRegions(buildDistrictMarkers(presaleListings, complexes));
      setComplexes(complexes);
      const complexById = new Map(complexes.map((complex) => [complex.id, complex]));
      setTradeListings(
        presaleListings
          .map((listing) => {
            const complex = complexById.get(listing.complexId);
            return complex ? toListing(listing, complex) : null;
          })
          .filter((listing): listing is Listing => listing !== null),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const allListings = useMemo(
    () => [...tradeListings, ...noticeListings],
    [tradeListings, noticeListings],
  );
  const filteredListings = useMemo(
    () =>
      allListings.filter(
        (item) =>
          (filter === "all" || item.type === filter) &&
          matchesRegion(item.district, regionFilter),
      ),
    [filter, regionFilter, allListings],
  );
  const totalRegionCount = regions.reduce((sum, region) => sum + region.listingCount, 0);

  // ---------- 카카오 지도 핀 ----------
  const complexById = useMemo(() => new Map(complexes.map((complex) => [complex.id, complex])), [complexes]);
  const noticeById = useMemo(() => new Map(noticeListings.map((listing) => [listing.notice?.id, listing])), [noticeListings]);
  const tradeById = useMemo(() => new Map(tradeListings.map((listing) => [listing.id, listing])), [tradeListings]);
  const districtOf = useCallback((marker: MapMarker): string | null => {
    if (marker.kind === "notice") return noticeById.get(marker.noticeId)?.district ?? null;
    const complex = complexById.get(marker.complexId);
    return complex ? districtKey(complex.sido, complex.sigungu) : null;
  }, [complexById, noticeById]);
  const markerFilter = useCallback(
    (marker: MapMarker) =>
      (filter === "all" || (filter === "trade" ? marker.kind === "listing" : marker.kind === "notice")) &&
      (marker.kind === "listing" || isCurrentStatus(marker.status, marker.applicationsCloseOn)) &&
      matchesRegion(districtOf(marker), regionFilter),
    [filter, regionFilter, districtOf],
  );
  const pinPrice = useCallback((marker: Extract<MapMarker, { kind: "listing" }>) => tradeById.get(marker.listingId)?.price.split(" ")[0] ?? null, [tradeById]);
  async function openMarker(marker: MapMarker) {
    if (marker.kind === "notice") {
      const listing = noticeById.get(marker.noticeId);
      if (listing) onOpenListing(listing);
      else toast("공고 정보를 불러오는 중이에요. 잠시 뒤 다시 눌러주세요");
      return;
    }
    const known = tradeById.get(marker.listingId);
    if (known) return onOpenListing(known);
    const presale = await presaleRepository.getListing(marker.listingId);
    const complex = presale ? await presaleRepository.getComplex(presale.complexId) : null;
    if (presale && complex) onOpenListing(toListing(presale, complex));
    else toast("매물 정보를 찾을 수 없어요");
  }
  /** 지도 아래 목록: 카카오 지도면 지금 화면 안의 핀, 그림 지도면 기존처럼 필터 결과 */
  const bottomListings = visibleMarkers === null
    ? filteredListings
    : visibleMarkers.flatMap((marker) => {
        const listing = marker.kind === "listing" ? tradeById.get(marker.listingId) : noticeById.get(marker.noticeId);
        return listing ? [listing] : [];
      });

  function selectRegion(key: string | null) {
    setRegionFilter(key);
    const region = regions.find((item) => item.key === key);
    if (region) setMapFocus({ ...region.center });
    if (key !== null) {
      setMapMode("pins");
      if (filter === "notice") setFilter("all");
    }
  }
  const filterOptions = [{ id: "all" as const, label: "전체" }, { id: "notice" as const, label: "청약공고" }, { id: "trade" as const, label: "분양권거래" }];

  return (
    <div className="screen-content">
      <header className="page-header"><div><p className="eyebrow">내 관심지역</p><h1>{interestHeadline(profile.interestRegions)}</h1></div><button className="icon-button"><SlidersHorizontal size={19} /></button></header>
      <main className="listing-main">
        <div className="search-bar"><Search size={16} /><span>지역, 단지명으로 찾아보세요</span><button><SlidersHorizontal size={16} /></button></div>
        <div className="filter-row">{filterOptions.map((option) => <button key={option.id} className={`filter-chip ${filter === option.id ? "active" : ""}`} onClick={() => setFilter(option.id)}>{option.label}<span>{option.id === "all" ? allListings.length : allListings.filter((item) => item.type === option.id).length}</span></button>)}</div>
        <div className="filter-row ps-region-row"><button className={`filter-chip ${regionFilter === null ? "active" : ""}`} onClick={() => selectRegion(null)}>전체 지역<span>{totalRegionCount}건</span></button>{regions.map((region) => <button key={region.key} className={`filter-chip ${regionFilter === region.key ? "active" : ""}`} onClick={() => selectRegion(regionFilter === region.key ? null : region.key)}>{region.key}<span>{region.listingCount}건 · 평균 {formatWonShort(region.averagePremium)}</span></button>)}</div>
        <div className="listing-toolbar"><span><strong>{filteredListings.length}개</strong>의 매물이 있어요</span><div className="view-toggle"><button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><MapIcon size={15} />지도</button><button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><MoreHorizontal size={15} />목록</button></div></div>
        {viewMode === "map" ? <KakaoMap mode={mapMode} onModeChange={setMapMode} filter={markerFilter} districtOf={districtOf} pinPrice={pinPrice} onOpenMarker={(marker) => void openMarker(marker)} onVisibleChange={setVisibleMarkers} focus={mapFocus} fallback={<MapCanvas filteredListings={filteredListings} onOpenListing={onOpenListing} mode={mapMode} onModeChange={setMapMode} regions={regions} onSelectRegion={selectRegion} regionFilter={regionFilter} />} /> : <div className="listing-stack">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} />)}</div>}
        {viewMode === "map" && <div className="map-bottom-list"><div className="map-bottom-heading"><span>지도에서 보고 있는 매물</span><button onClick={() => setViewMode("list")}>목록으로 <ChevronRight size={14} /></button></div>{bottomListings.slice(0, 2).map((listing) => <ListingCard key={`${listing.type}-${listing.id}`} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}</div>}
      </main>
    </div>
  );
}
