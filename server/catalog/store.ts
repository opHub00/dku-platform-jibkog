import type { CatalogComplexDetail, HousingType } from "../../client/src/features/catalog/types";
import { evaluateTrust } from "../../client/src/features/presale/ai/trustEngine";
import type { Complex, PresaleListing } from "../../client/src/features/presale/types";
import type { Store, StoreTx, UserRow } from "../store/types";

const regionRate = { 서울: 0.12, 경기: 0.09, 인천: 0.07 } as const;
const supportedRegion = (region: string): region is keyof typeof regionRate => region in regionRate;

export function catalogStoreId(id: string): string { return `catalog-${id}`; }

export function asPresaleComplex(detail: CatalogComplexDetail): Complex | null {
  if (!supportedRegion(detail.region)) return null;
  return {
    id: catalogStoreId(detail.id), name: detail.name, address: detail.address,
    sido: detail.region, sigungu: detail.sigungu,
    lat: detail.location?.lat ?? 0, lng: detail.location?.lng ?? 0,
    moveInMonth: detail.moveInMonth ?? "", resaleRestrictionEndsOn: null,
    supplyAreas: [...new Set(detail.housingTypes.map((type) => type.supplyAreaM2))].sort((a, b) => a - b),
    referencePremiumRate: regionRate[detail.region], image: "/assets/modern-home.jpg",
  };
}

/** 카탈로그 단지를 기존 분양권 단지 저장소에 같은 id로 재사용한다. */
export async function ensureCatalogComplex(tx: StoreTx, detail: CatalogComplexDetail): Promise<string> {
  const complex = asPresaleComplex(detail);
  if (!complex) throw new Error("지원하지 않는 지역입니다");
  const districtId = `${complex.sido}-${complex.sigungu}`;
  await tx.upsertDistrict({ id: districtId, sido: complex.sido, sigungu: complex.sigungu });
  await tx.upsertComplex({
    id: complex.id, district_id: districtId, name: complex.name, address: complex.address,
    latitude: detail.location?.lat ?? null, longitude: detail.location?.lng ?? null,
    move_in_month: detail.moveInMonth, resale_restriction_ends_on: null,
    reference_premium_rate: complex.referencePremiumRate, image: complex.image,
  });
  for (const area of complex.supplyAreas) await tx.upsertComplexArea({ complex_id: complex.id, area_m2: area });
  return complex.id;
}

function candidateKey(detail: CatalogComplexDetail, type: HousingType): string { return `${detail.id}:${type.modelNumber}`; }
function hash(value: string): number { let result = 0; for (const char of value) result = (result * 31 + char.charCodeAt(0)) >>> 0; return result; }

/** 수집한 좌표·최고가가 있는 주택형 중 최대 40개를 예시 매물로 보충한다. 재시작해도 중복 생성하지 않는다. */
export async function syncCatalogExamples(store: Store, details: CatalogComplexDetail[], log: (message: string) => void = () => undefined): Promise<number> {
  const candidates = details
    .filter((detail) => detail.location && supportedRegion(detail.region))
    .flatMap((detail) => detail.housingTypes.filter((type) => type.maxPriceWon > 0 && type.supplyAreaM2 > 0).map((type) => ({ detail, type })))
    .sort((a, b) => (b.detail.notices[0]?.publishedOn ?? "").localeCompare(a.detail.notices[0]?.publishedOn ?? ""));
  const selected = candidates.slice(0, 40);
  if (selected.length < 30) log(`예시 매물 후보가 ${selected.length}개라 가능한 만큼만 생성합니다`);
  let inserted = 0;
  await store.write(async (tx) => {
    const existing = await tx.listTradeListings();
    const sellers = (await Promise.all([1, 2, 3, 4, 5].map((id) => tx.findUserById(id)))).filter((user): user is UserRow => !!user?.email.endsWith("@jibkog.dev") && user.identity_verified);
    if (!sellers.length) return;
    for (const { detail, type } of selected) {
      if (existing.some((row) => row.catalog_complex_id === detail.id && row.housing_model_number === type.modelNumber && sellers.some((seller) => seller.id === row.seller_id))) continue;
      const complex = asPresaleComplex(detail);
      if (!complex) continue;
      const complexId = await ensureCatalogComplex(tx, detail);
      const seed = hash(candidateKey(detail, type));
      const seller = sellers[seed % sellers.length];
      const rate = regionRate[detail.region as keyof typeof regionRate] * (0.8 + (seed % 41) / 100);
      const premium = Math.round(type.maxPriceWon * rate / 10_000) * 10_000;
      const paidAmount = Math.round(type.maxPriceWon * 0.3 / 10_000) * 10_000;
      const createdAt = new Date(Date.now() - inserted * 60_000).toISOString();
      const description = "수집한 청약 공고 정보를 바탕으로 만든 예시 매물입니다. 실제 거래 매물이 아닙니다.";
      const listing: PresaleListing = {
        id: 0, complexId, catalogComplexId: detail.id, housingModelNumber: type.modelNumber,
        seller: { id: seller.id, nickname: seller.nickname, realName: seller.real_name ?? seller.nickname, identityVerified: seller.identity_verified, tradeCount: 0 },
        area: type.supplyAreaM2, floor: 10 + seed % 20, salePrice: type.maxPriceWon, premium, optionCost: 0,
        paidAmount, description, documents: [
          { type: "salesContract", status: "pending" }, { type: "paymentProof", status: "pending" }, { type: "optionContract", status: "missing" },
        ], status: "selling", liked: false, createdAt, isDemo: true,
      };
      const trust = evaluateTrust({
        listing, complex, allListings: [], allComplexes: [complex],
        contract: { mode: "demo", result: {
          complexName: complex.name, exclusiveArea: type.supplyAreaM2, salePrice: type.maxPriceWon,
          contractorName: listing.seller.realName, contractDate: null, confidence: 0.9, forgeryNotes: [],
        } },
        screening: { mode: "demo", result: { findings: [] } },
      });
      const row = await tx.insertListing({
        type: "trade", complex_id: complexId, catalog_complex_id: detail.id, housing_model_number: type.modelNumber,
        title: `${detail.name} ${Math.round(type.supplyAreaM2 * 100) / 100}㎡`, description, created_at: createdAt, urgent: false,
        seller_id: seller.id, status: trust.score < 50 ? "review" : "selling", area_m2: type.supplyAreaM2,
        floor: listing.floor, sale_price: type.maxPriceWon, premium, option_cost: 0, paid_amount: paidAmount,
        is_demo: true,
      });
      for (const doc of listing.documents) await tx.upsertTradeDocument({ listing_id: row.id, kind: doc.type, status: doc.status, storage_key: null });
      await tx.insertTrustReport({ listing_id: row.id, evaluated_at: trust.evaluatedAt, score: trust.score, mode: trust.mode, report_json: trust });
      inserted++;
    }
  });
  log(`예시 매물: 새로 ${inserted}건, 대상 ${selected.length}건`);
  return inserted;
}
