export type Geocode = { latitude: number; longitude: number; matched_address: string };
export type GeocodeCache = Record<string, Geocode | null>;

const normalizeAddress = (address: string) => address.trim().replace(/\s+(?:일원|일대)\s*$/, "").replace(/\s+/g, " ");

const LOT = /^(산?\d+(?:-\d+)?)(?:번지)?/;

/**
 * 카카오 주소 검색에 차례로 넣어 볼 주소.
 * 공고 주소에는 "59-10번지 외 3필지", "220-2외 5필지", "747-1, 마곡지구 17단지", "(고덕강일공공주택지구 3단지)" 같은 꼬리가 붙어
 * 그대로는 못 찾는 경우가 많다. 두 번째 후보는 "시도 시군구 동 첫 지번"까지만 남긴다(동 중심 좌표로 대신하지는 않는다).
 */
export function addressCandidates(address: string): string[] {
  const base = normalizeAddress(address);
  const tokens = base.replace(/\(.*?\)/g, " ").replace(/,/g, " , ").split(/\s+/).filter(Boolean);
  let lotAddress = "";
  for (let i = 2; i < tokens.length; i++) {
    if (tokens[i] === ",") break;
    const lot = LOT.exec(tokens[i]);
    if (lot) {
      lotAddress = [...tokens.slice(0, i), lot[1]].join(" ");
      break;
    }
  }
  // "김포 풍무역세권 B4블록 (경기도 김포시 사우동 458번지 일원)"처럼 괄호 안에 실제 주소가 있는 경우
  const inner = /\(([^()]*\d[^()]*)\)/.exec(base)?.[1];
  const innerCandidates = inner && /^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)/.test(inner.trim()) ? addressCandidates(inner) : [];
  return [...new Set([base, lotAddress, ...innerCandidates].filter(Boolean))];
}

/** "경기도 남양주시 진건읍 …" → "남양주시" (키워드 검색 결과가 같은 시군구인지 확인용) */
function sigunguOf(address: string): string | null {
  return normalizeAddress(address).split(" ").find((token, index) => index > 0 && /(시|군|구)$/.test(token)) ?? null;
}

/** 주소별 결과(검색 실패 null 포함)를 보관해 동일 주소를 재조회하지 않는다. */
export function createGeocoder(options: {
  restApiKey: string;
  cache?: GeocodeCache;
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  maxRequests?: number;
}) {
  const cache: GeocodeCache = { ...options.cache };
  const fetchImpl = options.fetchImpl ?? fetch;
  const interval = options.minIntervalMs ?? 120;
  const maxRequests = options.maxRequests ?? 2_000;
  let requests = 0;
  let lastRequest = 0;
  return {
    cache,
    get requests() { return requests; },
    /** title을 주면 주소로 못 찾을 때 단지 이름으로 장소(아파트)를 찾아본다 */
    async lookup(address: string, title?: string): Promise<Geocode | null> {
      for (const query of addressCandidates(address)) {
        const found = await lookupOne(query);
        if (found) return found;
      }
      const sigungu = sigunguOf(address);
      return title && sigungu ? lookupPlace(title, sigungu) : null;
    },
  };

  async function request(endpoint: "address" | "keyword", query: string): Promise<unknown[]> {
    if (++requests > maxRequests) throw new Error(`카카오 주소 조회 상한(${maxRequests}회)에 도달했습니다`);
    const wait = lastRequest + interval - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    const url = new URL(`https://dapi.kakao.com/v2/local/search/${endpoint}.json`);
    url.searchParams.set("query", query);
    url.searchParams.set("size", endpoint === "address" ? "1" : "5");
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { Authorization: `KakaoAK ${options.restApiKey}` }, signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new Error("카카오 주소 검색 연결에 실패했습니다");
    }
    if (!response.ok) throw new Error(`카카오 ${endpoint === "address" ? "주소" : "장소"} 검색 HTTP ${response.status}`);
    const payload: unknown = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object" || !("documents" in payload) || !Array.isArray(payload.documents)) throw new Error("카카오 주소 검색 응답 형식이 올바르지 않습니다");
    return payload.documents;
  }

  function toGeocode(row: unknown, fallbackName: string): Geocode {
    if (!row || typeof row !== "object" || !("x" in row) || !("y" in row)) throw new Error("카카오 좌표 형식이 올바르지 않습니다");
    const longitude = Number(row.x);
    const latitude = Number(row.y);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("카카오 좌표 범위가 올바르지 않습니다");
    const matched = "address_name" in row && typeof row.address_name === "string" ? row.address_name : fallbackName;
    return { latitude, longitude, matched_address: matched };
  }

  /**
   * 단지 이름 장소 검색. 택지지구 "A-2블록"처럼 지번이 없는 공고용.
   * 같은 시군구의 "아파트" 장소만 쓰고, 견본주택·모델하우스(실제 단지와 위치가 다름)는 버린다.
   */
  async function lookupPlace(title: string, sigungu: string): Promise<Geocode | null> {
    const name = title.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
    const key = `place:${name}|${sigungu}`;
    if (Object.hasOwn(cache, key)) return cache[key];
    const rows = await request("keyword", name);
    const row = rows.find((item) => {
      if (!item || typeof item !== "object") return false;
      const category = "category_name" in item && typeof item.category_name === "string" ? item.category_name : "";
      const place = "place_name" in item && typeof item.place_name === "string" ? item.place_name : "";
      const address = "address_name" in item && typeof item.address_name === "string" ? item.address_name : "";
      return category.includes("아파트") && !/견본주택|모델하우스|홍보관|분양/.test(`${category} ${place}`) && address.includes(sigungu);
    });
    return (cache[key] = row ? toGeocode(row, name) : null);
  }

  /** 주소 하나를 그대로 조회한다(못 찾은 결과 null도 캐시) */
  async function lookupOne(query: string): Promise<Geocode | null> {
    if (!query) return null;
    if (Object.hasOwn(cache, query)) return cache[query];
    const row = (await request("address", query))[0];
    return (cache[query] = row === undefined ? null : toGeocode(row, query));
  }
}
