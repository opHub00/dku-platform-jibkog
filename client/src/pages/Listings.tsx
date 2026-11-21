import { useMemo, useState } from "react";
import { ChevronRight, Map, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Listing, ListingType } from "@/types";
import { listings } from "@/data/listings";
import { ListingCard } from "@/components/common/ListingCard";

type ViewMode = "map" | "list";

function MapCanvas({
  filteredListings,
  onOpenListing,
}: {
  filteredListings: Listing[];
  onOpenListing: (listing: Listing) => void;
}) {
  const pinPositions = [
    { left: "19%", top: "26%" },
    { left: "56%", top: "21%" },
    { left: "72%", top: "55%" },
    { left: "36%", top: "68%" },
  ];
  return (
    <div className="map-canvas">
      <div className="map-grid" />
      <div className="map-water water-one" /><div className="map-water water-two" />
      <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
      <div className="map-label label-one">반포대로</div><div className="map-label label-two">잠원동</div><div className="map-label label-three">고속터미널</div><div className="map-label label-four">서초</div>
      {filteredListings.map((listing, index) => {
        const position = pinPositions[index % pinPositions.length];
        return <button key={listing.id} className={`map-pin ${listing.type === "trade" ? "trade-pin" : "notice-pin"}`} style={position} onClick={() => onOpenListing(listing)}><span>{listing.type === "trade" ? "거래" : "청약"}</span><b>{listing.type === "trade" ? listing.price.split(" ")[0] : "공고"}</b></button>;
      })}
      <div className="map-current"><span /></div>
      <div className="map-scale">현재 위치 기준 · 1.2km</div>
    </div>
  );
}

export function ListingsView({ onOpenListing }: { onOpenListing: (listing: Listing) => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [filter, setFilter] = useState<"all" | ListingType>("all");
  const filteredListings = useMemo(() => filter === "all" ? listings : listings.filter((item) => item.type === filter), [filter]);
  const filterOptions = [{ id: "all" as const, label: "전체" }, { id: "notice" as const, label: "청약공고" }, { id: "trade" as const, label: "분양권거래" }];

  return (
    <div className="screen-content">
      <header className="page-header"><div><p className="eyebrow">내 관심지역</p><h1>서울 · 서초구</h1></div><button className="icon-button"><SlidersHorizontal size={19} /></button></header>
      <main className="listing-main">
        <div className="search-bar"><Search size={16} /><span>지역, 단지명으로 찾아보세요</span><button><SlidersHorizontal size={16} /></button></div>
        <div className="filter-row">{filterOptions.map((option) => <button key={option.id} className={`filter-chip ${filter === option.id ? "active" : ""}`} onClick={() => setFilter(option.id)}>{option.label}<span>{option.id === "all" ? listings.length : listings.filter((item) => item.type === option.id).length}</span></button>)}</div>
        <div className="listing-toolbar"><span><strong>{filteredListings.length}개</strong>의 매물이 있어요</span><div className="view-toggle"><button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><Map size={15} />지도</button><button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><MoreHorizontal size={15} />목록</button></div></div>
        {viewMode === "map" ? <MapCanvas filteredListings={filteredListings} onOpenListing={onOpenListing} /> : <div className="listing-stack">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} />)}</div>}
        {viewMode === "map" && <div className="map-bottom-list"><div className="map-bottom-heading"><span>지도에서 보고 있는 매물</span><button onClick={() => setViewMode("list")}>목록으로 <ChevronRight size={14} /></button></div>{filteredListings.slice(0, 2).map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}</div>}
      </main>
    </div>
  );
}
