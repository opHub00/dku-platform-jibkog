export type Tab = "home" | "listings" | "chat" | "favorites" | "my";

export type ListingType = "trade" | "notice";

import type { Complex, PresaleListing } from "@/features/presale/types";

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
};
