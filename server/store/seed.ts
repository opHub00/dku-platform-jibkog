import { seedListings } from "../../client/src/features/presale/data/listings";
import { hashPasswordSync } from "../auth";
import { emptyTables, type Tables } from "./jsonFileStore";

/** 시드 판매자 계정 비밀번호(개발용). docs/api.md에 적어 둔다 */
export const SEED_PASSWORD = "jibkog-demo-1234";

export function districtId(sido: string, sigungu: string): string {
  return `${sido}-${sigungu}`;
}

/**
 * 처음 실행할 때 넣는 데이터: 예시 판매자 계정(seller1~5@jibkog.dev)만.
 * 단지와 예시 매물은 넣지 않는다. 손으로 만든 예전 예시 단지(래미안 원베일리 등)는 공고 데이터가 아니라서 뺐고,
 * 예시 매물은 서버가 켜질 때 수집한 청약 공고 단지 위에 만든다(server/catalog/store.ts syncCatalogExamples).
 */
export function buildSeedTables(now: Date = new Date()): Tables {
  const tables = emptyTables();
  const createdAt = now.toISOString();
  // 판매자 이름·본인인증 여부는 프론트 시드 매물의 판매자 정보를 그대로 쓴다(닉네임마다 계정 하나)
  for (const { seller } of seedListings) {
    if (tables.users.some((user) => user.nickname === seller.nickname)) continue;
    const id = tables.users.length + 1;
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
  return tables;
}
