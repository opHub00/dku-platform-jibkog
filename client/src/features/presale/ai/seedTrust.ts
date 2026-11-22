import type { Complex, PresaleListing } from "../types";
import { demoExtractContract, demoScreenDescription } from "./demoRules";
import { evaluateTrust } from "./trustEngine";
import type { AiResult, ContractExtraction } from "./types";

/** 시드 매물의 계약서 인식 신뢰도(데모). 서류 상태가 좋을수록 높게 둔다. */
const SEED_CONFIDENCE = { verified: 0.93, pending: 0.7 } as const;

function seedContract(
  listing: PresaleListing,
  complex: Complex,
): AiResult<ContractExtraction> | null {
  const status = listing.documents.find((d) => d.type === "salesContract")?.status;
  if (status === undefined || status === "missing") return null;
  return {
    mode: "demo",
    result: demoExtractContract(
      {
        complexName: complex.name,
        area: listing.area,
        salePrice: listing.salePrice,
        contractorName: listing.seller.realName,
      },
      SEED_CONFIDENCE[status],
    ),
  };
}

/** 시드 매물마다 데모 모드로 신뢰 검증 결과를 계산해 붙인다. */
export function attachSeedTrust(
  listings: PresaleListing[],
  complexes: Complex[],
  now: Date = new Date(),
): PresaleListing[] {
  const complexById = new Map(complexes.map((c) => [c.id, c]));
  return listings.map((listing) => {
    const complex = complexById.get(listing.complexId);
    if (!complex) return listing;
    const trust = evaluateTrust({
      listing,
      complex,
      allListings: listings,
      allComplexes: complexes,
      contract: seedContract(listing, complex),
      screening: { mode: "demo", result: demoScreenDescription(listing.description) },
      now,
    });
    return { ...listing, trust };
  });
}
