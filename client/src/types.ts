export type Tab = "home" | "listings" | "chat" | "favorites" | "my";

export type ListingType = "trade" | "notice";

import type { Complex, PresaleListing } from "@/features/presale/types";
import type { Notice } from "@/features/catalog/types";

export type Listing = {
  id: number;
  type: ListingType;
  title: string;
  location: string;
  price: string;
  detail: string;
  date: string;
  image: string;
  tag: string;
  tagTone: "green" | "navy" | "sand";
  liked?: boolean;
  urgent?: boolean;
  presale?: PresaleListing;
  complex?: Complex;
  /** 청약 공고(type이 notice일 때) */
  notice?: Notice;
  /** 지도 핀 위치 계산용 위도·경도 */
  lat?: number;
  lng?: number;
  /** 시군구. 예: "서울 서초구" */
  district?: string;
};
