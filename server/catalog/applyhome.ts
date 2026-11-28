import type { RawHousingType, RawNotice } from "./fixture";

const BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1";
const PAGE_SIZE = 100;
/** 공공데이터포털 계정별 승인 한도를 알 수 없으므로 한 번의 갱신에 보수적인 상한을 둔다. */
export const MAX_APPLYHOME_REQUESTS = 800;
const REGIONS = ["서울", "경기", "인천"] as const;

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string => value === null || value === undefined ? "" : String(value).trim();
const count = (value: unknown): number => { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0; };
const date = (value: unknown): string => /^\d{4}-\d{2}-\d{2}$/.test(str(value)) ? str(value) : "";

export type ApplyhomeOptions = {
  serviceKey: string;
  since: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  minIntervalMs?: number;
  maxRequests?: number;
};

/** 청약홈 공고·주택형을 순차 수집한다. 요청 URL과 키는 로그에 남기지 않는다. */
export async function fetchAptNotices(options: ApplyhomeOptions): Promise<RawNotice[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? (() => undefined);
  const maxRequests = options.maxRequests ?? MAX_APPLYHOME_REQUESTS;
  const interval = options.minIntervalMs ?? 120;
  let requests = 0;
  let lastRequest = 0;
  const key = decodeURIComponent(options.serviceKey.trim());

  async function page(endpoint: string, params: Record<string, string | number>): Promise<{ rows: JsonObject[]; matchCount: number | null }> {
    if (++requests > maxRequests) throw new Error(`청약홈 갱신 요청 상한(${maxRequests}회)에 도달했습니다`);
    const wait = lastRequest + interval - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    const url = new URL(`${BASE}/${endpoint}`);
    url.searchParams.set("serviceKey", key);
    url.searchParams.set("returnType", "JSON");
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    let response: Response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new Error("청약홈 연결에 실패했습니다");
    }
    if (!response.ok) throw new Error(`청약홈 HTTP ${response.status}`);
    const payload: unknown = await response.json().catch(() => null);
    if (!object(payload) || !Array.isArray(payload.data) || !payload.data.every(object)) throw new Error("청약홈 응답 형식이 올바르지 않습니다");
    const matched = payload.matchCount === null || payload.matchCount === undefined ? NaN : Number(payload.matchCount);
    return { rows: payload.data, matchCount: Number.isSafeInteger(matched) && matched >= 0 ? matched : null };
  }

  async function models(houseNo: string, noticeNo: string): Promise<RawHousingType[]> {
    const result: RawHousingType[] = [];
    for (let pageNo = 1; ; pageNo++) {
      const { rows, matchCount } = await page("getAPTLttotPblancMdl", {
        page: pageNo, perPage: PAGE_SIZE,
        "cond[HOUSE_MANAGE_NO::EQ]": houseNo,
        "cond[PBLANC_NO::EQ]": noticeNo,
      });
      for (const row of rows) {
        if (str(row.HOUSE_MANAGE_NO) !== houseNo || str(row.PBLANC_NO) !== noticeNo) throw new Error("청약홈 주택형 식별자가 일치하지 않습니다");
        const housingType = str(row.HOUSE_TY);
        const modelNumber = str(row.MODEL_NO);
        const supplyArea = Number(row.SUPLY_AR);
        const maxPrice = Number(row.LTTOT_TOP_AMOUNT);
        if (!modelNumber || !/^\d+(?:\.\d+)?/.test(housingType) || !Number.isFinite(supplyArea) || !Number.isFinite(maxPrice) || maxPrice <= 0) continue;
        result.push({
          model_number: modelNumber, housing_type: housingType, supply_area_m2: String(supplyArea),
          max_price_krw_10000: String(maxPrice), general_supply_units: count(row.SUPLY_HSHLDCO),
          special_supply_units: count(row.SPSPLY_HSHLDCO),
        });
      }
      if (rows.length < PAGE_SIZE || (matchCount !== null && pageNo * PAGE_SIZE >= matchCount)) break;
    }
    return result;
  }

  const notices: RawNotice[] = [];
  const seen = new Set<string>();
  for (const region of REGIONS) {
    let regionCount = 0;
    for (let pageNo = 1; ; pageNo++) {
      const { rows, matchCount } = await page("getAPTLttotPblancDetail", {
        page: pageNo, perPage: PAGE_SIZE,
        "cond[SUBSCRPT_AREA_CODE_NM::EQ]": region,
        "cond[RCRIT_PBLANC_DE::GTE]": options.since,
      });
      for (const row of rows) {
        const id = str(row.HOUSE_MANAGE_NO);
        const noticeNumber = str(row.PBLANC_NO);
        const published = date(row.RCRIT_PBLANC_DE);
        const address = str(row.HSSPLY_ADRES);
        if (!id || !noticeNumber || !published || published < options.since || !address || !str(row.HOUSE_NM)) continue;
        const key = `${id}:${noticeNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const open = date(row.RCEPT_BGNDE) || date(row.SPSPLY_RCEPT_BGNDE) || date(row.GNRL_RNK1_CRSPAREA_RCPTDE_PD) || published;
        const close = date(row.RCEPT_ENDDE) || date(row.GNRL_RNK2_ETC_AREA_RCPTDE_PD) || open;
        notices.push({
          id, notice_number: noticeNumber, title: str(row.HOUSE_NM), address,
          published_on: published, applications_open: open, applications_close: close,
          notice_url: str(row.PBLANC_URL) || `https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=${encodeURIComponent(id)}&pblancNo=${encodeURIComponent(noticeNumber)}`,
          website_url: str(row.HMPG_ADRES) || null, coordinates: null,
          total_units: count(row.TOT_SUPLY_HSHLDCO), housing_types: [],
          applyhome_raw: { MVN_PREARNGE_YM: str(row.MVN_PREARNGE_YM), SUBSCRPT_AREA_CODE_NM: region },
        });
        regionCount++;
      }
      log(`청약홈 ${region}: 공고 ${regionCount}건, 목록 ${pageNo}쪽`);
      if (rows.length < PAGE_SIZE || (matchCount !== null && pageNo * PAGE_SIZE >= matchCount)) break;
    }
  }
  for (let i = 0; i < notices.length; i++) {
    const notice = notices[i];
    notice.housing_types = await models(notice.id, notice.notice_number);
    if ((i + 1) % 25 === 0 || i + 1 === notices.length) log(`청약홈 주택형: ${i + 1}/${notices.length}건, 요청 ${requests}회`);
  }
  log(`청약홈 수집 완료: 공고 ${notices.length}건, 요청 ${requests}회`);
  return notices;
}
