import type {
  CatalogComplex,
  CatalogComplexDetail,
  CatalogRegion,
  HousingType,
  ListingMarker,
  MapMarker,
  Notice,
  NoticeMarker,
  NoticeStatus,
} from "../../client/src/features/catalog/types";
import { CATALOG_PAGE_SIZE, CATALOG_REGIONS, MAX_MAP_MARKERS } from "../../client/src/features/catalog/types";
import * as svc from "../api/services";
import { inBounds, type CatalogSource } from "./source";

/**
 * 카탈로그·지도 API의 임시 응답(서버 구현 전까지 화면 개발용).
 * 샘플 5개는 api/results.json(origin/feature/api)의 notices[]에서 키·개인정보 없이 필요한 필드만 옮겼다.
 * 원본 형식 그대로 두고 toNotice/toComplex로 변환하므로, 실제 구현도 같은 변환을 쓰면 된다.
 */

// ---------------------------------------------------------------- results.json 원본 형식(필요한 필드만)

export type RawHousingType = {
  model_number: string;
  housing_type: string;
  /** ㎡, 문자열 */
  supply_area_m2: string;
  /** 만원 단위, 문자열 */
  max_price_krw_10000: string;
  general_supply_units: number;
  special_supply_units: number;
};

export type RawNotice = {
  id: string;
  notice_number: string;
  title: string;
  address: string;
  published_on: string;
  applications_open: string;
  applications_close: string;
  notice_url: string;
  website_url: string | null;
  coordinates: { latitude: number; longitude: number; matched_address: string } | null;
  total_units: number;
  housing_types: RawHousingType[];
  /** 청약홈 원본 중 쓰는 필드: 입주예정월(YYYYMM), 공급지역명 */
  applyhome_raw: { MVN_PREARNGE_YM?: string; SUBSCRPT_AREA_CODE_NM?: string };
};

const ht = (model_number: string, housing_type: string, supply_area_m2: string, max_price_krw_10000: string, general_supply_units: number, special_supply_units: number): RawHousingType => ({
  model_number, housing_type, supply_area_m2, max_price_krw_10000, general_supply_units, special_supply_units,
});

const APPLYHOME = "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do";

export const SAMPLE_NOTICES: readonly RawNotice[] = [
  {
    id: "2026000560", notice_number: "2026000560", title: "해링턴 플레이스 문래",
    address: "서울특별시 영등포구 문래동3가 27-1번지 일원",
    published_on: "2026-11-13", applications_open: "2026-11-23", applications_close: "2026-11-26",
    notice_url: `${APPLYHOME}?houseManageNo=2026000560&pblancNo=2026000560`, website_url: "https://www.해링턴플레이스문래.com",
    coordinates: { latitude: 37.5189899995753, longitude: 126.900096441767, matched_address: "서울 영등포구 문래동3가 27-1" },
    total_units: 218,
    housing_types: [ht("01", "084.9409A", "109.7007", "182700", 51, 59), ht("02", "084.9708B", "110.4326", "178500", 25, 29), ht("03", "084.9894C", "108.7429", "177500", 25, 29)],
    applyhome_raw: { MVN_PREARNGE_YM: "203003", SUBSCRPT_AREA_CODE_NM: "서울" },
  },
  {
    id: "2026000505", notice_number: "2026000505", title: "경희궁 에피트",
    address: "서울특별시 종로구 교남동 28번지 일원",
    published_on: "2026-11-13", applications_open: "2026-11-25", applications_close: "2026-11-30",
    notice_url: `${APPLYHOME}?houseManageNo=2026000505&pblancNo=2026000505`, website_url: "https://brand.hldni.com/gyeonghuigung/",
    coordinates: { latitude: 37.5679377419544, longitude: 126.965043855505, matched_address: "서울 종로구 교남동 28" },
    total_units: 134,
    housing_types: [ht("01", "039.9342 ", "54.2361", "118241", 5, 0), ht("02", "059.9926 ", "78.3717", "189843", 13, 18), ht("03", "084.9794A", "111.3570", "257484", 25, 28), ht("04", "084.9940B", "110.9884", "251744", 19, 26)],
    applyhome_raw: { MVN_PREARNGE_YM: "203008", SUBSCRPT_AREA_CODE_NM: "서울" },
  },
  {
    id: "2026000497", notice_number: "2026000497", title: "중화역 라온프라이빗 센트로",
    address: "서울특별시 중랑구 중화동 303-9번지 일원",
    published_on: "2026-11-06", applications_open: "2026-11-16", applications_close: "2026-11-19",
    notice_url: `${APPLYHOME}?houseManageNo=2026000497&pblancNo=2026000497`, website_url: "https://www.jh-raon.com",
    coordinates: { latitude: 37.6002298801859, longitude: 127.079268578008, matched_address: "서울 중랑구 중화동 303-9" },
    total_units: 113,
    housing_types: [
      ht("01", "045.0210 ", "60.8010", "65800", 4, 3), ht("02", "058.3650 ", "78.0460", "86200", 7, 10), ht("03", "059.9740 ", "79.8710", "95600", 9, 11),
      ht("04", "070.9640 ", "93.7800", "110100", 10, 16), ht("05", "073.4730T", "99.7040", "119200", 1, 0), ht("06", "084.9940 ", "112.1410", "127700", 15, 20),
      ht("07", "084.9400T", "114.0180", "139100", 2, 0), ht("08", "093.5970T", "125.9360", "150600", 1, 0), ht("09", "098.9000T", "131.8730", "160900", 2, 0),
      ht("10", "126.8090T", "168.9570", "202100", 2, 0),
    ],
    applyhome_raw: { MVN_PREARNGE_YM: "202902", SUBSCRPT_AREA_CODE_NM: "서울" },
  },
  {
    id: "2026000373", notice_number: "2026000373", title: "고덕강일지구 3단지 토지임대부(본청약)",
    address: "서울특별시 강동구 강일동 174 일원(고덕강일공공주택지구 3단지)",
    published_on: "2026-10-16", applications_open: "2026-10-26", applications_close: "2026-11-06",
    notice_url: `${APPLYHOME}?houseManageNo=2026000373&pblancNo=2026000373`, website_url: "https://www.i-sh.co.kr/main/index.do",
    coordinates: { latitude: 37.5725316965639, longitude: 127.169396435788, matched_address: "서울 강동구 강일동 174" },
    total_units: 1305,
    housing_types: [
      ht("01", "049.0000A", "72.5400", "30800", 5, 18), ht("02", "049.0000B", "72.5600", "30800", 2, 6), ht("03", "049.0000C", "72.1900", "31416", 19, 74),
      ht("04", "049.0000D", "72.2100", "30800", 3, 10), ht("05", "049.0000E", "72.3200", "30800", 4, 20), ht("06", "049.0000F", "72.6400", "31724", 14, 58),
      ht("07", "049.0000G", "72.0500", "31724", 2, 5), ht("08", "049.0000H", "73.5000", "29567", 8, 31), ht("09", "049.0000I", "73.2600", "31416", 2, 7),
      ht("10", "049.0000J", "72.3800", "31416", 2, 5), ht("11", "049.0000K", "72.2400", "30184", 3, 11), ht("12", "059.0000A", "86.5400", "38670", 6, 18),
      ht("13", "059.0000B", "86.7600", "39050", 12, 48), ht("14", "059.0000C", "87.1900", "38670", 1, 2), ht("15", "059.0000D", "87.1900", "39050", 16, 60),
      ht("16", "059.0000E", "87.1500", "38670", 9, 35), ht("17", "059.0000F", "86.6600", "37154", 9, 37), ht("18", "059.0000G", "86.9400", "37912", 25, 95),
      ht("19", "059.0000H", "86.5600", "37154", 4, 20), ht("20", "059.0000I", "88.6100", "39050", 1, 6),
    ],
    applyhome_raw: { MVN_PREARNGE_YM: "202705", SUBSCRPT_AREA_CODE_NM: "서울" },
  },
  {
    id: "2026000399", notice_number: "2026000399", title: "브라운스톤 월곡 센트럴",
    address: "서울특별시 성북구 하월곡동 70-4번지 일원",
    published_on: "2026-08-28", applications_open: "2026-09-07", applications_close: "2026-09-10",
    notice_url: `${APPLYHOME}?houseManageNo=2026000399&pblancNo=2026000399`, website_url: "https://www.브라운스톤월곡센트럴.com",
    coordinates: { latitude: 37.6058986239341, longitude: 127.03620594499, matched_address: "서울 성북구 하월곡동 70-4" },
    total_units: 62,
    housing_types: [ht("01", "059.9442A", "81.6956", "91000", 7, 21), ht("02", "059.9442B", "81.6956", "89200", 6, 5), ht("03", "059.9293C", "81.5083", "86200", 9, 9), ht("04", "074.9610 ", "102.5132", "107500", 5, 0)],
    applyhome_raw: { MVN_PREARNGE_YM: "202903", SUBSCRPT_AREA_CODE_NM: "서울" },
  },
];

// ---------------------------------------------------------------- 변환(원본 → 약속 타입)

/** 오늘 날짜 "YYYY-MM-DD"(한국 시간) */
export function todayKst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function noticeStatus(openOn: string, closeOn: string, today: string): NoticeStatus {
  if (today < openOn) return "upcoming";
  if (today > closeOn) return "closed";
  return "open";
}

function toRegion(raw: RawNotice): CatalogRegion {
  const name = raw.applyhome_raw.SUBSCRPT_AREA_CODE_NM ?? raw.address.slice(0, 2);
  return CATALOG_REGIONS.find((r) => name.startsWith(r)) ?? "서울";
}

/** "203003" → "2030-03" */
function toMonth(raw: string | undefined): string | null {
  return raw && /^\d{6}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}` : null;
}

export function toHousingType(raw: RawHousingType): HousingType {
  const code = raw.housing_type.trim();
  return {
    modelNumber: raw.model_number,
    housingTypeCode: code,
    exclusiveAreaM2: Number.parseFloat(code),
    supplyAreaM2: Number(raw.supply_area_m2),
    // 만원 → 원
    maxPriceWon: Math.round(Number(raw.max_price_krw_10000) * 10_000),
    generalUnits: raw.general_supply_units,
    specialUnits: raw.special_supply_units,
  };
}

/** 지금은 공고 하나 = 단지 하나. 단지 id는 첫 공고의 주택관리번호 */
const complexIdOf = (raw: RawNotice) => raw.id;

export function toNotice(raw: RawNotice, today: string): Notice {
  return {
    id: raw.id,
    noticeNumber: raw.notice_number,
    complexId: complexIdOf(raw),
    title: raw.title,
    address: raw.address,
    region: toRegion(raw),
    status: noticeStatus(raw.applications_open, raw.applications_close, today),
    publishedOn: raw.published_on,
    applicationsOpenOn: raw.applications_open,
    applicationsCloseOn: raw.applications_close,
    totalUnits: raw.total_units,
    noticeUrl: raw.notice_url,
    websiteUrl: raw.website_url,
    location: raw.coordinates ? { lat: raw.coordinates.latitude, lng: raw.coordinates.longitude } : null,
  };
}

export function toComplexDetail(raw: RawNotice, today: string): CatalogComplexDetail {
  const notice = toNotice(raw, today);
  const housingTypes = raw.housing_types.map(toHousingType).sort((a, b) => a.modelNumber.localeCompare(b.modelNumber));
  const prices = housingTypes.map((h) => h.maxPriceWon);
  // "서울특별시 영등포구 문래동3가 …" → "영등포구"
  const sigungu = raw.address.split(/\s+/)[1] ?? "";
  return {
    id: complexIdOf(raw),
    name: raw.title,
    address: raw.address,
    region: notice.region,
    sigungu,
    location: notice.location,
    moveInMonth: toMonth(raw.applyhome_raw.MVN_PREARNGE_YM),
    totalUnits: raw.total_units,
    latestNoticeId: notice.id,
    latestNoticeStatus: notice.status,
    maxPriceRangeWon: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    housingTypeCount: housingTypes.length,
    housingTypes,
    notices: [notice],
  };
}

function toSummary(detail: CatalogComplexDetail): CatalogComplex {
  const { housingTypes: _h, notices: _n, ...summary } = detail;
  return summary;
}

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// ---------------------------------------------------------------- 임시 구현

export function createFixtureCatalog(samples: readonly RawNotice[] = SAMPLE_NOTICES): CatalogSource {
  const details = () => {
    const today = todayKst();
    const groups = new Map<string, RawNotice[]>();
    for (const raw of samples) groups.set(raw.id, [...(groups.get(raw.id) ?? []), raw]);
    return [...groups.values()].map((group) => {
      group.sort((a, b) => b.published_on.localeCompare(a.published_on));
      const detail = toComplexDetail(group[0], today);
      const housingTypes = new Map([...group].reverse().flatMap((raw) => raw.housing_types.map((type) => [type.model_number, toHousingType(type)] as const)));
      detail.housingTypes = [...housingTypes.values()].sort((a, b) => a.modelNumber.localeCompare(b.modelNumber));
      detail.housingTypeCount = detail.housingTypes.length;
      const prices = detail.housingTypes.map((type) => type.maxPriceWon);
      detail.maxPriceRangeWon = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
      detail.notices = group.map((raw) => toNotice(raw, today));
      return detail;
    }).sort((a, b) => (b.notices[0]?.publishedOn ?? "").localeCompare(a.notices[0]?.publishedOn ?? ""));
  };

  return {
    async searchComplexes({ q, region, page }) {
      const needle = normalize(q);
      const matched = details().filter(
        (d) => (region === null || d.region === region) && (needle === "" || normalize(d.name).includes(needle) || normalize(d.address).includes(needle)),
      );
      const start = (page - 1) * CATALOG_PAGE_SIZE;
      return {
        items: matched.slice(start, start + CATALOG_PAGE_SIZE).map(toSummary),
        page,
        pageSize: CATALOG_PAGE_SIZE,
        total: matched.length,
        hasNext: start + CATALOG_PAGE_SIZE < matched.length,
      };
    },

    async getComplex(id) {
      return details().find((d) => d.id === id) ?? null;
    },

    async listNotices({ status }) {
      return details()
        .flatMap((d) => d.notices)
        .filter((n) => status === null || n.status === status)
        .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
    },

    async mapMarkers(store, bounds, options) {
      // 공고 핀: 좌표가 있는 공고만. recentDays를 주면 오래전에 마감한 공고는 뺀다
      const recentDays = options?.recentDays ?? null;
      const cutoff = recentDays === null ? null : new Date(Date.parse(`${todayKst()}T00:00:00Z`) - recentDays * 86_400_000).toISOString().slice(0, 10);
      const noticeMarkers: NoticeMarker[] = details()
        .flatMap((d) => d.notices)
        .filter((n) => cutoff === null || n.status !== "closed" || n.applicationsCloseOn >= cutoff)
        // 잘라야 할 때 최근 공고가 남도록 마감일 최신순
        .sort((a, b) => b.applicationsCloseOn.localeCompare(a.applicationsCloseOn))
        .flatMap((n): NoticeMarker[] =>
          n.location && inBounds(bounds, n.location.lat, n.location.lng)
            ? [{ kind: "notice", key: `notice-${n.id}`, noticeId: n.id, complexId: n.complexId, lat: n.location.lat, lng: n.location.lng, title: n.title, status: n.status, applicationsOpenOn: n.applicationsOpenOn, applicationsCloseOn: n.applicationsCloseOn }]
            : [],
        );

      // 매물 핀: 공개 매물(판매 중·예약 중)만. 좌표는 매물 단지 좌표
      const [listings, complexes] = await Promise.all([svc.listListings(store, null), svc.listComplexes(store)]);
      const listingMarkers: ListingMarker[] = listings.flatMap((l): ListingMarker[] => {
        if (l.status !== "selling" && l.status !== "reserved") return [];
        const c = complexes.find((x) => x.id === l.complexId);
        if (!c || !inBounds(bounds, c.lat, c.lng)) return [];
        return [{ kind: "listing", key: `listing-${l.id}`, listingId: l.id, complexId: c.id, lat: c.lat, lng: c.lng, title: c.name, areaM2: l.area, premiumWon: l.premium, isDemo: l.isDemo === true }];
      });

      const all: MapMarker[] = [...listingMarkers, ...noticeMarkers];
      return { markers: all.slice(0, MAX_MAP_MARKERS), truncated: all.length > MAX_MAP_MARKERS };
    },
  };
}
