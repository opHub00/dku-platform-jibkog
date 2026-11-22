import { useEffect, useMemo, useState } from "react";
import { useProfileState } from "@/features/profile/lib/useProfile";
import { newsRepository } from "../api/newsRepository";
import type { NewsResponse } from "../types";
import { buildNewsQueries } from "./queries";

export type NewsState = {
  queries: string[];
  /** 불러오는 중이면 null */
  data: NewsResponse | null;
};

/**
 * 내 정보의 관심지역·관심 면적으로 검색어를 만들어 뉴스를 불러온다.
 * 내 정보를 다 읽은 뒤에만 요청하고, 검색어가 달라지면(내 정보 변경) 다시 불러온다.
 * 서버로는 검색어만 보낸다.
 */
export function useNews(): NewsState {
  const { profile, loaded } = useProfileState();
  const queries = useMemo(
    () => buildNewsQueries(profile.interestRegions, profile.interestAreas),
    [profile.interestRegions, profile.interestAreas],
  );
  const queryKey = queries.join("|");
  const [data, setData] = useState<NewsResponse | null>(null);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    setData(null);
    void newsRepository.fetchNews(queryKey === "" ? [] : queryKey.split("|")).then((response) => {
      if (active) setData(response);
    });
    return () => {
      active = false;
    };
  }, [queryKey, loaded]);

  return { queries, data };
}

/** 최신순 정렬 */
export function sortByNewest<T extends { publishedAt: string }>(articles: T[]): T[] {
  return [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
