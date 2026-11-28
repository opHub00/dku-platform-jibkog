import type { Complex, Sido } from "@/features/presale/types";
import type { CatalogComplexDetail, HousingType } from "../types";
import { shortAddress } from "./noticeText";

const PRESALE_SIDOS: readonly Sido[] = ["서울", "경기", "인천"];
/** 같은 시군구 거래가 없을 때 쓰는 참고 프리미엄률(기존 단지 평균이 없을 때) */
const DEFAULT_PREMIUM_RATE = 0.1;

/** 109.7007 → 109.7 (소수 둘째 자리까지) */
export function roundArea(m2: number): number {
  return Math.round(m2 * 100) / 100;
}

/** "084.9409A" → "84A타입", "059.9926" → "59타입" */
export function housingTypeLabel(type: HousingType): string {
  const suffix = type.housingTypeCode.replace(/^[\d.]+/, "").trim();
  return `${Math.floor(type.exclusiveAreaM2)}${suffix}타입`;
}

/** 서버가 카탈로그 단지로 만드는 단지 id(docs/api-catalog.md 5절) */
export function catalogStoreComplexId(catalogId: string): string {
  return `catalog-${catalogId}`;
}

/**
 * 카탈로그 단지를 매물 등록·신뢰 검증이 쓰는 Complex로 바꾼다.
 * 전매제한일은 공고 데이터에 없어서 null(서버가 최종 판단), 이미지는 기본 사진을 쓴다.
 */
export function catalogToComplex(detail: CatalogComplexDetail, knownComplexes: Complex[] = []): Complex {
  const sigungu = detail.sigungu;
  const inPresaleRegion = PRESALE_SIDOS.find((s) => s === detail.region);
  const rates = knownComplexes.map((c) => c.referencePremiumRate).filter((r) => Number.isFinite(r));
  return {
    id: catalogStoreComplexId(detail.id),
    name: detail.name,
    address: shortAddress(detail),
    // 서울·경기·인천 밖 단지는 같은 이름 시군구(예: 중구)와 섞이지 않게 시도 이름을 앞에 붙인다
    sido: inPresaleRegion ?? "서울",
    sigungu: inPresaleRegion ? sigungu : `${detail.region} ${sigungu}`,
    lat: detail.location?.lat ?? 0,
    lng: detail.location?.lng ?? 0,
    moveInMonth: detail.moveInMonth ?? "",
    resaleRestrictionEndsOn: null,
    supplyAreas: detail.housingTypes.map((h) => roundArea(h.supplyAreaM2)),
    referencePremiumRate: rates.length ? rates.reduce((sum, r) => sum + r, 0) / rates.length : DEFAULT_PREMIUM_RATE,
    image: "/assets/apt-city.jpg",
  };
}
