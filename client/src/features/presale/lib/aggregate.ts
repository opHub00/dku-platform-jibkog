import type { Complex, DistrictSummary, PresaleListing } from "../types";
import { calcPremiumRate } from "./funds";

/**
 * 시군구별 거래(매물) 집계. 단지 정보가 없는 매물은 건너뛴다.
 * 매물 수가 많은 순, 같으면 평균 프리미엄이 높은 순으로 정렬한다.
 */
export function aggregateByDistrict(
  listings: PresaleListing[],
  complexes: Complex[],
): DistrictSummary[] {
  const complexById = new Map(complexes.map((c) => [c.id, c]));
  const groups = new Map<
    string,
    { complex: Complex; count: number; premium: number; rateSum: number }
  >();

  for (const listing of listings) {
    const complex = complexById.get(listing.complexId);
    if (!complex) continue;
    const key = `${complex.sido}|${complex.sigungu}`;
    const group = groups.get(key) ?? {
      complex,
      count: 0,
      premium: 0,
      rateSum: 0,
    };
    group.count += 1;
    group.premium += listing.premium;
    group.rateSum += calcPremiumRate(listing);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map(
      ({ complex, count, premium, rateSum }): DistrictSummary => ({
        sido: complex.sido,
        sigungu: complex.sigungu,
        listingCount: count,
        totalPremium: premium,
        averagePremium: Math.round(premium / count),
        averagePremiumRate: rateSum / count,
      }),
    )
    .sort(
      (a, b) =>
        b.listingCount - a.listingCount || b.averagePremium - a.averagePremium,
    );
}
