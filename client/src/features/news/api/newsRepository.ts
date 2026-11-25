import { buildSampleArticles } from "../lib/sample";
import { parseNewsResponse, type NewsRequest, type NewsResponse } from "../types";

/**
 * 맞춤 뉴스 저장소 인터페이스.
 * 서버로 보내는 값은 검색어뿐이다. 프로필의 다른 정보는 이 인터페이스로 넘어오지 않는다.
 */
export interface NewsRepository {
  fetchNews(queries: string[]): Promise<NewsResponse>;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 60_000;

function sampleResponse(): NewsResponse {
  return { source: "sample", classifiedBy: "rule", articles: buildSampleArticles() };
}

/** /api/news 호출. 실패하면(개발 서버 없음·네트워크 오류) 샘플 뉴스로 대체한다. */
export function createHttpNewsRepository(): NewsRepository {
  const cache = new Map<string, { at: number; response: Promise<NewsResponse> }>();

  async function request(queries: string[]): Promise<NewsResponse> {
    const body: NewsRequest = { queries };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) return sampleResponse();
      const json: unknown = await response.json();
      if (typeof json === "object" && json !== null && "ok" in json && json.ok === true && "result" in json) {
        return parseNewsResponse(json.result) ?? sampleResponse();
      }
      return sampleResponse();
    } catch {
      return sampleResponse();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    fetchNews(queries) {
      if (queries.length === 0) return Promise.resolve(sampleResponse());
      const key = queries.join("|");
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.response;
      const response = request(queries);
      cache.set(key, { at: Date.now(), response });
      return response;
    },
  };
}

export const newsRepository: NewsRepository = createHttpNewsRepository();
