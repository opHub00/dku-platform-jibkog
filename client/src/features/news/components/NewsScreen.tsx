import { useState } from "react";
import { ExternalLink, Info, X } from "lucide-react";
import { StatusPill } from "@/components/common/StatusPill";
import { formatRelativeDate } from "@/features/presale/lib/format";
import { AI_PROVIDER_LABELS } from "@/features/presale/ai/types";
import { sortByNewest, useNews } from "../lib/useNews";
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS, type NewsCategory } from "../types";
import "../news.css";

/** 맞춤 뉴스 전체 화면. 기사를 누르면 원문을 새 탭으로 연다. */
export function NewsScreen({ onClose }: { onClose: () => void }) {
  const { queries, data } = useNews();
  const [filter, setFilter] = useState<"all" | NewsCategory>("all");
  const articles = data ? sortByNewest(data.articles) : [];
  const visible = filter === "all" ? articles : articles.filter((article) => article.category === filter);
  const countOf = (category: NewsCategory) => articles.filter((article) => article.category === category).length;

  return (
    <div className="detail-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">부동산 뉴스{data?.source === "sample" ? " · 샘플 뉴스" : ""}</p>
          <h1>내 관심지역 뉴스</h1>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="뉴스 닫기">
          <X size={19} />
        </button>
      </header>

      <main className="detail-body">
        <div className="nw-status">
          {data?.source === "sample" && <StatusPill tone="sand">샘플 뉴스</StatusPill>}
          {data && <StatusPill tone={data.classifiedBy === "ai" ? "green" : "neutral"}>{data.classifiedBy === "ai" ? `AI 분류${data.analyzedBy ? ` · ${AI_PROVIDER_LABELS[data.analyzedBy.provider]}` : ""}` : "규칙 분류(데모)"}</StatusPill>}
          <span>{queries.length > 0 ? `검색어 ${queries.join(" · ")}` : "관심지역을 정하면 맞춤 뉴스를 찾아드릴게요"}</span>
        </div>

        <div className="filter-row">
          <button className={`filter-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            전체<span>{articles.length}</span>
          </button>
          {NEWS_CATEGORIES.map((category) => (
            <button key={category} className={`filter-chip ${filter === category ? "active" : ""}`} onClick={() => setFilter(category)}>
              {NEWS_CATEGORY_LABELS[category]}
              <span>{countOf(category)}</span>
            </button>
          ))}
        </div>

        <div className="news-list">
          {!data && <p className="nw-empty">맞춤 뉴스를 찾고 있어요</p>}
          {data && visible.length === 0 && <p className="nw-empty">이 분류에 해당하는 뉴스가 없어요</p>}
          {visible.map((article, index) => (
            <a key={article.id} className="news-row nw-link" href={article.link} target="_blank" rel="noopener noreferrer">
              <div className={`news-number number-${Math.min(index + 1, 3)}`}>{String(index + 1).padStart(2, "0")}</div>
              <div>
                <span>{NEWS_CATEGORY_LABELS[article.category]}</span>
                <h3>{article.title}</h3>
                <p>
                  {formatRelativeDate(article.publishedAt)}
                  {data?.source === "naver" ? ` · ${article.query}` : ""}
                </p>
                <p className="nw-why">{article.whyItMatters}</p>
              </div>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>

        <p className="sheet-footnote nw-disclaimer">
          <Info size={12} /> 뉴스는 정보 제공 목적이며 투자 권유가 아니에요
        </p>
      </main>
    </div>
  );
}
