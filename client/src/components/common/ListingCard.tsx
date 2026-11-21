import { Heart } from "lucide-react";
import type { Listing } from "@/types";
import { StatusPill } from "./StatusPill";

export function ListingCard({
  listing,
  onOpen,
  onToggleLike,
  compact = false,
}: {
  listing: Listing;
  onOpen: () => void;
  onToggleLike: () => void;
  compact?: boolean;
}) {
  return (
    <article className={`listing-card ${compact ? "compact" : ""}`} onClick={onOpen}>
      <div className="listing-image-wrap">
        <img src={listing.image} alt="" className="listing-image" />
        <StatusPill tone={listing.tagTone}>{listing.tag}</StatusPill>
        <button
          className={`image-heart ${listing.liked ? "liked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLike();
          }}
          aria-label="찜하기"
        >
          <Heart size={16} fill={listing.liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="listing-copy">
        <div className="listing-meta">
          <span>{listing.location}</span>
          <span>{listing.date}</span>
        </div>
        <h3>{listing.title}</h3>
        <p className="listing-price">{listing.price}</p>
        {listing.type === "trade" && (
          <div className="listing-trade-summary">
            <span>총 필요자금 23.1억</span>
            <span>서류 3/4 확인</span>
          </div>
        )}
        <p className="listing-detail">{listing.detail}</p>
      </div>
    </article>
  );
}
