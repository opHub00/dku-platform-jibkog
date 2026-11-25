import { seedComplexes } from "../../client/src/features/presale/data/complexes";
import { seedListings } from "../../client/src/features/presale/data/listings";
import { attachSeedTrust } from "../../client/src/features/presale/ai/seedTrust";
import { hashPasswordSync } from "../auth";
import { emptyTables, type Tables } from "./jsonFileStore";

/** 시드 판매자 계정 비밀번호(개발용). docs/api.md에 적어 둔다 */
export const SEED_PASSWORD = "jibkog-demo-1234";

export function districtId(sido: string, sigungu: string): string {
  return `${sido}-${sigungu}`;
}

/**
 * 처음 실행할 때 넣는 데이터: 지금 프론트의 시드 단지·매물과, 그 매물의 판매자 계정들.
 * 매물 id는 프론트 시드와 같게 둔다(1, 3, 5, 6, 7).
 */
export function buildSeedTables(now: Date = new Date()): Tables {
  const tables = emptyTables();
  const createdAt = now.toISOString();

  for (const complex of seedComplexes) {
    const id = districtId(complex.sido, complex.sigungu);
    if (!tables.districts.some((d) => d.id === id)) tables.districts.push({ id, sido: complex.sido, sigungu: complex.sigungu });
    tables.complexes.push({
      id: complex.id,
      district_id: id,
      name: complex.name,
      address: complex.address,
      latitude: complex.lat,
      longitude: complex.lng,
      move_in_month: complex.moveInMonth,
      resale_restriction_ends_on: complex.resaleRestrictionEndsOn,
      reference_premium_rate: complex.referencePremiumRate,
      image: complex.image,
    });
    for (const area of complex.supplyAreas) tables.complex_areas.push({ complex_id: complex.id, area_m2: area });
  }

  // 판매자마다 계정 하나
  const sellerIdByNickname = new Map<string, number>();
  for (const listing of seedListings) {
    const { seller } = listing;
    if (sellerIdByNickname.has(seller.nickname)) continue;
    const id = tables.users.length + 1;
    sellerIdByNickname.set(seller.nickname, id);
    tables.users.push({
      id,
      nickname: seller.nickname,
      real_name: seller.realName,
      identity_verified: seller.identityVerified,
      membership: "free",
      email: `seller${id}@jibkog.dev`,
      password_hash: hashPasswordSync(SEED_PASSWORD),
      created_at: createdAt,
    });
  }

  const complexById = new Map(seedComplexes.map((c) => [c.id, c]));
  for (const listing of attachSeedTrust(seedListings, seedComplexes, now)) {
    const complex = complexById.get(listing.complexId);
    const sellerId = sellerIdByNickname.get(listing.seller.nickname);
    if (!complex || sellerId === undefined) continue;
    tables.listings.push({
      id: listing.id,
      type: "trade",
      complex_id: listing.complexId,
      title: `${complex.name} ${listing.area}㎡`,
      description: listing.description,
      created_at: listing.createdAt,
      urgent: false,
      seller_id: sellerId,
      status: listing.status,
      area_m2: listing.area,
      floor: listing.floor,
      sale_price: listing.salePrice,
      premium: listing.premium,
      option_cost: listing.optionCost,
      paid_amount: listing.paidAmount,
    });
    for (const doc of listing.documents) {
      tables.trade_documents.push({ listing_id: listing.id, kind: doc.type, status: doc.status, storage_key: null });
    }
    if (listing.trust) {
      tables.trust_reports.push({
        id: tables.trust_reports.length + 1,
        listing_id: listing.id,
        evaluated_at: listing.trust.evaluatedAt,
        score: listing.trust.score,
        mode: listing.trust.mode,
        report_json: listing.trust,
      });
    }
  }
  return tables;
}
