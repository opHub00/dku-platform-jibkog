import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Layers, Map as MapIcon, MapPin, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Listing, ListingType } from "@/types";
import { listings } from "@/data/listings";
import { ListingCard } from "@/components/common/ListingCard";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { toListing } from "@/features/presale/lib/toListing";
import { formatWonShort } from "@/features/presale/lib/format";
import { buildDistrictMarkers, projectToMap, spreadPositions, type DistrictMarker, type MapPosition } from "@/features/presale/lib/mapProjection";
import "@/features/presale/presale.css";

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
}: {
  filteredListings: Listing[];
  onOpenListing: (listing: Listing) => void;
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  regions: DistrictMarker[];
  onSelectRegion: (key: string) => void;
}) {
  const located = filteredListings.filter(
    (listing): listing is Listing & { lat: number; lng: number } =>
      listing.lat !== undefined && listing.lng !== undefined,
  );
  const [canvasRef, size] = useElementSize<HTMLDivElement>();
  const pinPositions = spreadPositions(projectToMap(located), PIN_MIN_DISTANCE, {
    ...size,
    padding: {
      top: TOGGLE_SPACE + PIN_HALF.height,
      right: PIN_HALF.width,
      bottom: SCALE_SPACE + PIN_HALF.height,
      left: PIN_HALF.width,
    },
  });
  const pinPositionByKey = new Map(
    located.map((listing, index) => [`${listing.type}-${listing.id}`, pinPositions[index]]),
  );
  const largestBubble = Math.max(0, ...regions.map((region) => regionBubbleSize(region.listingCount)));
  const bubbleHalf = largestBubble / 2 + 6;
  const regionPositions = spreadPositions(
    projectToMap(regions.map((region) => region.center)),
    largestBubble + 6,
    {
      ...size,
      padding: { top: TOGGLE_SPACE + bubbleHalf, right: bubbleHalf, bottom: SCALE_SPACE + bubbleHalf, left: bubbleHalf },
    },
  );
  return (
    <div className="map-canvas" ref={canvasRef}>
      <div className="map-grid" />
      <div className="map-water water-one" /><div className="map-water water-two" />
      <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
      <div className="map-label label-one">반포대로</div><div className="map-label label-two">잠원동</div><div className="map-label label-three">고속터미널</div><div className="map-label label-four">서초</div>
      <div className="view-toggle ps-map-toggle"><button className={mode === "pins" ? "active" : ""} onClick={() => onModeChange("pins")}><MapPin size={13} />매물</button><button className={mode === "regions" ? "active" : ""} onClick={() => onModeChange("regions")}><Layers size={13} />지역별 거래</button></div>
      {mode === "pins" && filteredListings.map((listing, index) => {
        const projected = pinPositionByKey.get(`${listing.type}-${listing.id}`);
        const position = projected ? toStyle(projected) : FALLBACK_PIN_POSITIONS[index % FALLBACK_PIN_POSITIONS.length];
        return <button key={`${listing.type}-${listing.id}`} className={`map-pin ${listing.type === "trade" ? "trade-pin" : "notice-pin"}`} style={position} onClick={() => onOpenListing(listing)}><span>{listing.type === "trade" ? "거래" : "청약"}</span><b>{listing.type === "trade" ? listing.price.split(" ")[0] : "공고"}</b></button>;
      })}
      {mode === "regions" && regions.map((region, index) => {
        const size = regionBubbleSize(region.listingCount);
        return <button key={region.key} className="ps-region-bubble" style={{ ...toStyle(regionPositions[index]), width: size, height: size }} onClick={() => onSelectRegion(region.key)} aria-label={`${region.key} 분양권 거래 ${region.listingCount}건 보기`}><span>{region.key}</span><b>· {region.listingCount}건</b></button>;
      })}
      <div className="map-current"><span /></div>
      <div className="map-scale">현재 위치 기준 · 1.2km</div>
    </div>
  );
}

export function ListingsView({ onOpenListing }: { onOpenListing: (listing: Listing) => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [filter, setFilter] = useState<"all" | ListingType>("all");
  const [tradeListings, setTradeListings] = useState<Listing[]>([]);
  const [mapMode, setMapMode] = useState<MapMode>("pins");
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [regions, setRegions] = useState<DistrictMarker[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      presaleRepository.listListings(),
      presaleRepository.listComplexes(),
    ]).then(([presaleListings, complexes]) => {
      if (!active) return;
      setRegions(buildDistrictMarkers(presaleListings, complexes));
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
    () => [...tradeListings, ...listings.filter((item) => item.type === "notice")],
    [tradeListings],
  );
  const filteredListings = useMemo(
    () =>
      allListings.filter(
        (item) =>
          (filter === "all" || item.type === filter) &&
          (regionFilter === null || item.district === regionFilter),
      ),
    [filter, regionFilter, allListings],
  );
  const totalRegionCount = regions.reduce((sum, region) => sum + region.listingCount, 0);

  function selectRegion(key: string | null) {
    setRegionFilter(key);
    if (key !== null) {
      setMapMode("pins");
      if (filter === "notice") setFilter("all");
    }
  }
  const filterOptions = [{ id: "all" as const, label: "전체" }, { id: "notice" as const, label: "청약공고" }, { id: "trade" as const, label: "분양권거래" }];

  return (
    <div className="screen-content">
      <header className="page-header"><div><p className="eyebrow">내 관심지역</p><h1>서울 · 서초구</h1></div><button className="icon-button"><SlidersHorizontal size={19} /></button></header>
      <main className="listing-main">
        <div className="search-bar"><Search size={16} /><span>지역, 단지명으로 찾아보세요</span><button><SlidersHorizontal size={16} /></button></div>
        <div className="filter-row">{filterOptions.map((option) => <button key={option.id} className={`filter-chip ${filter === option.id ? "active" : ""}`} onClick={() => setFilter(option.id)}>{option.label}<span>{option.id === "all" ? allListings.length : allListings.filter((item) => item.type === option.id).length}</span></button>)}</div>
        <div className="filter-row ps-region-row"><button className={`filter-chip ${regionFilter === null ? "active" : ""}`} onClick={() => selectRegion(null)}>전체 지역<span>{totalRegionCount}건</span></button>{regions.map((region) => <button key={region.key} className={`filter-chip ${regionFilter === region.key ? "active" : ""}`} onClick={() => selectRegion(regionFilter === region.key ? null : region.key)}>{region.key}<span>{region.listingCount}건 · 평균 {formatWonShort(region.averagePremium)}</span></button>)}</div>
        <div className="listing-toolbar"><span><strong>{filteredListings.length}개</strong>의 매물이 있어요</span><div className="view-toggle"><button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><MapIcon size={15} />지도</button><button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><MoreHorizontal size={15} />목록</button></div></div>
        {viewMode === "map" ? <MapCanvas filteredListings={filteredListings} onOpenListing={onOpenListing} mode={mapMode} onModeChange={setMapMode} regions={regions} onSelectRegion={selectRegion} /> : <div className="listing-stack">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} />)}</div>}
        {viewMode === "map" && <div className="map-bottom-list"><div className="map-bottom-heading"><span>지도에서 보고 있는 매물</span><button onClick={() => setViewMode("list")}>목록으로 <ChevronRight size={14} /></button></div>{filteredListings.slice(0, 2).map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}</div>}
      </main>
    </div>
  );
}
