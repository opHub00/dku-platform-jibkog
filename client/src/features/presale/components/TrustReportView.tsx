import { AlertTriangle, Check, ChevronRight, ShieldAlert } from "lucide-react";
import { StatusPill } from "@/components/common/StatusPill";
import { TRUST_SOURCE_LABELS } from "../ai/trustEngine";
import type { TrustItem, TrustItemStatus, TrustReport } from "../types";
import "../presale.css";

/**
 * 신뢰 검증 결과. DetailView의 "집콕 검증 리포트" 섹션 구조를 그대로 따른다.
 * 점수 막대 너비와 색(70점 이상 기존 세이지, 50~69 샌드, 50 미만 위험색)만 점수에 맞게 바꾼다.
 */

const STATUS_PILL: Record<TrustItemStatus, { tone: "green" | "sand" | "neutral"; label: string }> = {
  pass: { tone: "green", label: "확인 완료" },
  warn: { tone: "sand", label: "확인 필요" },
  fail: { tone: "neutral", label: "확인 실패" },
};

function toneClass(score: number): string {
  if (score >= 70) return "";
  if (score >= 50) return "ps-tone-sand";
  return "ps-tone-danger";
}

function ItemIcon({ status }: { status: TrustItemStatus }) {
  if (status === "pass") {
    return (
      <span className="check-icon">
        <Check size={12} />
      </span>
    );
  }
  return <span className={`pending-icon ${status === "fail" ? "ps-fail-icon" : ""}`}>!</span>;
}

function itemMeta(item: TrustItem): string {
  const points = item.maxScore > 0 ? ` · ${item.score}/${item.maxScore}점` : "";
  return `${item.description} · 출처 ${TRUST_SOURCE_LABELS[item.source]}${points}`;
}

export function TrustReportView({
  report,
  onShowCriteria,
}: {
  report: TrustReport;
  /** 넘기면 기존 디자인처럼 "산정 기준" 링크를 보여준다 */
  onShowCriteria?: () => void;
}) {
  const score = Math.max(0, Math.min(100, report.score));

  return (
    <section className={`detail-section safety-section ${toneClass(score)}`}>
      <div className="section-header">
        <div>
          <p className="eyebrow">
            집콕 검증 리포트 · {report.mode === "live" ? "AI 검증" : "데모 검증"}
          </p>
          <h2>
            거래 안전도 <span className="score-highlight">{score}점</span>
          </h2>
        </div>
        {onShowCriteria && (
          <button className="report-link" onClick={onShowCriteria}>
            산정 기준 <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="safety-meter">
        <div className="meter-track">
          <span className="ps-meter-fill" style={{ width: `${score}%` }} />
        </div>
        <strong>{report.grade}</strong>
      </div>

      {!report.tradable ? (
        <div className="safety-note ps-report-note ps-note-danger">
          <ShieldAlert size={19} />
          <div>
            <strong>지금은 거래할 수 없어요</strong>
            <p>
              {report.items.find((item) => item.key === "resale")?.description ??
                report.caps.join(" · ")}
            </p>
          </div>
        </div>
      ) : (
        report.caps.length > 0 && (
          <div className="safety-note ps-report-note ps-note-sand">
            <AlertTriangle size={19} />
            <div>
              <strong>점수 상한이 적용됐어요</strong>
              <p>
                {report.caps.join(" · ")} (항목 합계 {report.rawScore}점)
              </p>
            </div>
          </div>
        )
      )}

      <div className="verification-list">
        {report.items.map((item) => {
          const pill = STATUS_PILL[item.status];
          return (
            <div key={item.key}>
              <ItemIcon status={item.status} />
              <div>
                <b>{item.label}</b>
                <small>{itemMeta(item)}</small>
              </div>
              {item.status === "fail" ? (
                <span className="ps-pill-danger">
                  <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                </span>
              ) : (
                <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
