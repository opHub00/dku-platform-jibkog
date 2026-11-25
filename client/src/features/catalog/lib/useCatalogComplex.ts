import { useEffect, useState } from "react";
import { getCatalogComplex } from "../api/catalogApi";
import type { CatalogComplexDetail } from "../types";

/** 카탈로그 단지 상세. id가 없거나 불러오는 중·실패면 null */
export function useCatalogComplex(id: string | null | undefined): CatalogComplexDetail | null {
  const [detail, setDetail] = useState<{ id: string; value: CatalogComplexDetail } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    getCatalogComplex(id)
      .then((value) => active && setDetail({ id, value }))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id]);
  return detail && detail.id === id ? detail.value : null;
}

/** 주택형 전용면적 범위. 예: "39~84㎡" */
export function exclusiveAreaRange(detail: CatalogComplexDetail): string {
  const areas = detail.housingTypes.map((h) => Math.floor(h.exclusiveAreaM2));
  if (areas.length === 0) return "-";
  const min = Math.min(...areas);
  const max = Math.max(...areas);
  return min === max ? `${min}㎡` : `${min}~${max}㎡`;
}
