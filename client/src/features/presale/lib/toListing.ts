import type { Listing } from "@/types";
import type { Complex, PresaleListing } from "../types";
import { formatMonth, formatRelativeDate, formatWon, formatWonShort } from "./format";
import { districtKey } from "./mapProjection";
import { shortAddress } from "@/features/catalog/lib/noticeText";
import { roundArea } from "@/features/catalog/lib/catalogComplex";

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
    // 공고 주택형 면적(109.7007㎡)은 소수 둘째 자리까지, 공고 주소("…27-1번지 일원")는 "시도 시군구 동"까지만 보여준다
    title: `${complex.name} ${roundArea(listing.area)}㎡`,
    location: complex.id.startsWith("catalog-") ? shortAddress({ address: complex.address, region: complex.sido }) : complex.address,
    price: formatWon(listing.salePrice + listing.premium),
    detail: `입주 예정 ${formatMonth(complex.moveInMonth)} · 프리미엄 ${formatWonShort(listing.premium)}`,
    date: formatRelativeDate(listing.createdAt, now),
    image: complex.image,
    tag: "분양권 거래",
    tagTone: "green",
    liked: listing.liked,
    presale: listing,
    complex,
    lat: complex.lat,
    lng: complex.lng,
    district: districtKey(complex.sido, complex.sigungu),
  };
}
