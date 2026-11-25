export type Geocode = { latitude: number; longitude: number; matched_address: string };
export type GeocodeCache = Record<string, Geocode | null>;

const normalizeAddress = (address: string) => address.trim().replace(/\s+(?:일원|일대)\s*$/, "").replace(/\s+/g, " ");

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
    async lookup(address: string): Promise<Geocode | null> {
      const query = normalizeAddress(address);
      if (!query) return null;
      if (Object.hasOwn(cache, query)) return cache[query];
      if (++requests > maxRequests) throw new Error(`카카오 주소 조회 상한(${maxRequests}회)에 도달했습니다`);
      const wait = lastRequest + interval - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
      url.searchParams.set("query", query);
      url.searchParams.set("size", "1");
      let response: Response;
      try {
        response = await fetchImpl(url, { headers: { Authorization: `KakaoAK ${options.restApiKey}` }, signal: AbortSignal.timeout(15_000) });
      } catch {
        throw new Error("카카오 주소 검색 연결에 실패했습니다");
      }
      if (!response.ok) throw new Error(`카카오 주소 검색 HTTP ${response.status}`);
      const payload: unknown = await response.json().catch(() => null);
      if (!payload || typeof payload !== "object" || !("documents" in payload) || !Array.isArray(payload.documents)) throw new Error("카카오 주소 검색 응답 형식이 올바르지 않습니다");
      const row: unknown = payload.documents[0];
      if (row === undefined) return (cache[query] = null);
      if (!row || typeof row !== "object" || !("x" in row) || !("y" in row)) throw new Error("카카오 좌표 형식이 올바르지 않습니다");
      const longitude = Number(row.x);
      const latitude = Number(row.y);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("카카오 좌표 범위가 올바르지 않습니다");
      const matched = "address_name" in row && typeof row.address_name === "string" ? row.address_name : query;
      return (cache[query] = { latitude, longitude, matched_address: matched });
    },
  };
}
