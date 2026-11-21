import type { Listing } from "@/types";
import type { Complex, PresaleListing } from "../types";
import { formatMonth, formatRelativeDate, formatWon, formatWonShort } from "./format";

/**
 * 분양권 매물을 기존 화면(ListingCard 등)이 쓰는 Listing 형태로 바꾼다.
 * price는 거래가(분양가 + 프리미엄)다.
 */
export function toListing(
  listing: PresaleListing,
  complex: Complex,
  now: Date = new Date(),
): Listing {
  return {
    id: listing.id,
    type: "trade",
    title: `${complex.name} ${listing.area}㎡`,
    location: complex.address,
    price: formatWon(listing.salePrice + listing.premium),
    detail: `입주 예정 ${formatMonth(complex.moveInMonth)} · 프리미엄 ${formatWonShort(listing.premium)}`,
    date: formatRelativeDate(listing.createdAt, now),
    image: complex.image,
    tag: "분양권 거래",
    tagTone: "green",
    liked: listing.liked,
  };
}
