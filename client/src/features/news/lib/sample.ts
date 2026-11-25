import { SAMPLE_ARTICLES, SAMPLE_QUERY } from "../data/sampleArticles";
import type { NewsArticle } from "../types";
import { classifyByRules, whyItMattersByRules } from "./classify";

/** 샘플 기사를 지금 시각 기준으로 만들고 규칙으로 분류한다(서버·클라이언트 공용). */
export function buildSampleArticles(now: Date = new Date()): NewsArticle[] {
  return SAMPLE_ARTICLES.map((sample, index) => {
    const category = classifyByRules(sample.title, sample.summary);
    return {
      id: `sample-${index + 1}`,
      title: sample.title,
      summary: sample.summary,
      link: sample.link,
      publishedAt: new Date(now.getTime() - sample.hoursAgo * 3_600_000).toISOString(),
      query: SAMPLE_QUERY,
      category,
      whyItMatters: whyItMattersByRules(category, SAMPLE_QUERY),
    };
  });
}
