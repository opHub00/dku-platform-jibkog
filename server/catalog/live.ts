import fs from "node:fs";
import path from "node:path";
import type { CatalogComplexDetail } from "../../client/src/features/catalog/types";
import { readDotenvValue } from "../env";
import { fetchAptNotices } from "./applyhome";
import { createFixtureCatalog, SAMPLE_NOTICES, todayKst, type RawNotice } from "./fixture";
import { createGeocoder, type GeocodeCache } from "./geocode";
import type { CatalogSource } from "./source";

const DAY_MS = 24 * 60 * 60 * 1000;
type CacheFile = { version: 1; fetchedAt: string; notices: RawNotice[]; geocodes: GeocodeCache };

function validNotice(value: unknown): value is RawNotice {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.notice_number === "string" && typeof row.title === "string" &&
    typeof row.address === "string" && typeof row.published_on === "string" && typeof row.applications_open === "string" &&
    typeof row.applications_close === "string" && Array.isArray(row.housing_types) &&
    row.housing_types.every((type: unknown) => type && typeof type === "object" && typeof (type as Record<string, unknown>).model_number === "string") &&
    !!row.applyhome_raw && typeof row.applyhome_raw === "object";
}

function readCache(file: string): CacheFile | null {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("fetchedAt" in value) || typeof value.fetchedAt !== "string" || !("notices" in value) || !Array.isArray(value.notices) || !value.notices.every(validNotice) || !("geocodes" in value) || !value.geocodes || typeof value.geocodes !== "object") return null;
    return value as CacheFile;
  } catch { return null; }
}

function writeCache(file: string, data: CacheFile) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data));
  fs.renameSync(temp, file);
}

export function createLiveCatalog(options: {
  envDir: string;
  cacheFile: string;
  log?: (message: string) => void;
  fetchImpl?: typeof fetch;
  /** 테스트용 명시적 키. 실제 서버는 .env/.env.local만 읽는다. */
  keys?: { applyhome: string | null; kakao: string | null };
  minIntervalMs?: number;
}) {
  const log = options.log ?? (() => undefined);
  const keys = options.keys ?? {
    applyhome: readDotenvValue(options.envDir, "DATA_GO_KR_SERVICE_KEY"),
    kakao: readDotenvValue(options.envDir, "KAKAO_REST_API_KEY"),
  };
  const cached = readCache(options.cacheFile);
  let active: readonly RawNotice[] = SAMPLE_NOTICES;
  if (keys.applyhome && keys.kakao && cached?.notices.length) active = cached.notices;

  const ready = (async () => {
    if (!keys.applyhome || !keys.kakao) {
      log("청약 카탈로그: 키가 없어 fixture 5건을 사용합니다");
      return;
    }
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < DAY_MS && cached.notices.length) {
      log(`청약 카탈로그: 하루 이내 캐시 ${cached.notices.length}건 재사용`);
      return;
    }
    try {
      const since = new Date(`${todayKst()}T00:00:00Z`);
      since.setUTCFullYear(since.getUTCFullYear() - 3);
      log(`청약 카탈로그: ${since.toISOString().slice(0, 10)} 이후 서울·경기·인천 APT 수집 시작`);
      const notices = await fetchAptNotices({ serviceKey: keys.applyhome, since: since.toISOString().slice(0, 10), fetchImpl: options.fetchImpl, minIntervalMs: options.minIntervalMs, log });
      if (notices.length === 0) throw new Error("수집된 공고가 없습니다");
      const geocoder = createGeocoder({ restApiKey: keys.kakao, cache: cached?.geocodes, fetchImpl: options.fetchImpl, minIntervalMs: options.minIntervalMs });
      for (let i = 0; i < notices.length; i++) {
        const notice = notices[i];
        try { notice.coordinates = await geocoder.lookup(notice.address); }
        catch (error) {
          log(`카카오 좌표 조회 실패 (${i + 1}/${notices.length}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
          if (error instanceof Error && /HTTP (401|403|429)|상한/.test(error.message)) throw error;
        }
        if ((i + 1) % 25 === 0 || i + 1 === notices.length) log(`카카오 좌표: ${i + 1}/${notices.length}건, 새 요청 ${geocoder.requests}회`);
      }
      writeCache(options.cacheFile, { version: 1, fetchedAt: new Date().toISOString(), notices, geocodes: geocoder.cache });
      active = notices;
      log(`청약 카탈로그: ${notices.length}건 저장 완료`);
    } catch (error) {
      log(`청약 카탈로그 갱신 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}. ${cached?.notices.length ? "기존 캐시" : "fixture"} 사용`);
      active = cached?.notices.length ? cached.notices : SAMPLE_NOTICES;
    }
  })();

  const catalog: CatalogSource = {
    async searchComplexes(query) { await ready; return createFixtureCatalog(active).searchComplexes(query); },
    async getComplex(id) { await ready; return createFixtureCatalog(active).getComplex(id); },
    async listNotices(query) { await ready; return createFixtureCatalog(active).listNotices(query); },
    async mapMarkers(store, bounds) { await ready; return createFixtureCatalog(active).mapMarkers(store, bounds); },
  };
  return {
    catalog,
    ready,
    async seedCandidates(): Promise<CatalogComplexDetail[]> {
      await ready;
      if (active === SAMPLE_NOTICES) return [];
      const source = createFixtureCatalog(active);
      const page = await source.searchComplexes({ q: "", region: null, page: 1 });
      const result: CatalogComplexDetail[] = [];
      for (let n = 1; n <= Math.ceil(page.total / page.pageSize); n++) {
        const batch = n === 1 ? page : await source.searchComplexes({ q: "", region: null, page: n });
        for (const item of batch.items) {
          const detail = await source.getComplex(item.id);
          if (detail?.location && detail.housingTypes.length) result.push(detail);
        }
      }
      return result;
    },
  };
}
