const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

/** 검색 API 제목·요약에 섞인 HTML 태그(<b> 등)와 엔티티(&quot; 등)를 정리한다. */
export function cleanNewsText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith("#")) {
        const code = parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    })
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 같은 기사인지 비교하기 위한 키(링크 기준, 없으면 제목) */
export function articleDedupKey(link: string, title: string): string {
  const normalizedLink = link.replace(/^https?:\/\//, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  return normalizedLink !== "" ? normalizedLink : title.replace(/\s/g, "");
}
