import { useEffect, useState } from "react";
import { listNotices } from "../api/catalogApi";
import type { Notice } from "../types";

/** 홈·매물 탭이 같은 공고 목록을 한 번만 불러오도록 모듈에 보관한다 */
let cache: Promise<Notice[]> | null = null;

export function loadNotices(): Promise<Notice[]> {
  cache ??= listNotices().catch((error: unknown) => {
    cache = null;
    throw error;
  });
  return cache;
}

/** 청약 공고 목록. 불러오는 중이면 null, 실패하면 빈 배열 */
export function useNotices(): Notice[] | null {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  useEffect(() => {
    let active = true;
    loadNotices()
      .then((loaded) => active && setNotices(loaded))
      .catch(() => active && setNotices([]));
    return () => {
      active = false;
    };
  }, []);
  return notices;
}
