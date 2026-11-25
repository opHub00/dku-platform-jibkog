import { useState } from "react";
import {
  ArrowLeft,
  Bot,
  Calculator,
  Check,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  Handshake,
  Heart,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Listing } from "@/types";
import { StatusPill } from "@/components/common/StatusPill";
import { SectionHeader } from "@/components/common/SectionHeader";
import { TrustReportView } from "@/features/presale/components/TrustReportView";
import { splitWon, suggestedOffer } from "@/features/chat/lib/format";
import { useChatRooms } from "@/features/chat/lib/useChat";
import { currentBuyer } from "@/features/presale/data/currentBuyer";
import { calcFundsBreakdown } from "@/features/presale/lib/funds";
import { formatWon, formatRate } from "@/features/presale/lib/format";
import { calcMatchSummary } from "@/features/presale/lib/match";
import { calcRoi } from "@/features/presale/lib/roi";
import {
  ACCOUNT_YEARS_OPTIONS,
  DEPENDENTS_OPTIONS,
  HOMELESS_YEARS_OPTIONS,
  SUBSCRIPTION_SCORE_MAX,
  calcSubscriptionScore,
} from "@/features/presale/lib/subscriptionScore";

export function ListingDetail({ listing, liked, isMine = false, onBack, onToggleLike, onGoChat, onSendOffer, onOpenInquiries }: {
  listing: Listing;
  liked: boolean;
  /** 로그인한 내가 판매자인 매물 */
  isMine?: boolean;
  onBack: () => void;
  onToggleLike: () => void;
  onGoChat: () => void;
  /** 가격 제안 시트에서 보낸 제안을 대화방에 넣는다 */
  onSendOffer?: (amount: number) => void;
  /** 내 매물의 문의 목록 열기 */
  onOpenInquiries?: () => void;
}) {
  const chatRooms = useChatRooms();
  const inquiryCount = (chatRooms ?? []).filter((room) => room.listingId === listing.id && room.myRole === "seller").length;
  const [showAi, setShowAi] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [roiMonths, setRoiMonths] = useState(12);
  const [roiGrowth, setRoiGrowth] = useState(0.006);
  const [showScore, setShowScore] = useState(false);
  const [homelessYears, setHomelessYears] = useState(3);
  const [dependents, setDependents] = useState(1);
  const [accountYears, setAccountYears] = useState(5);
  const isTrade = listing.type === "trade";
  const presale = listing.presale;
  const complex = listing.complex;
  const funds = presale ? calcFundsBreakdown(presale) : null;
  const match = presale && complex ? calcMatchSummary(presale, complex, currentBuyer) : null;
  const roi = presale ? calcRoi(presale, { holdingMonths: roiMonths, monthlyPremiumGrowthRate: roiGrowth }) : null;
  const score = calcSubscriptionScore({ homelessYears, dependents, accountYears });
  const verifiedDocumentCount = presale
    ? presale.documents.filter((document) => document.status === "verified").length
    : 0;
  const verifiedDocumentNames = presale
    ? presale.documents
        .filter((document) => document.status === "verified")
        .map((document) => ({
          salesContract: "분양계약서",
          paymentProof: "납부확인서",
          optionContract: "옵션계약서",
        }[document.type]))
        .join(" · ")
    : "";
  const sellerInitial = presale?.seller.realName.slice(0, 2) ?? "판매";
  const offerAmount = funds ? suggestedOffer(funds.totalRequired) : null;
  const offerParts = offerAmount ? splitWon(offerAmount) : null;

  return (
    <div className="detail-screen">
      <div className="detail-hero">
        <img src={listing.image} alt="" />
        <div className="hero-shade" />
        <div className="detail-top-actions">
          <button className="round-button" onClick={onBack}><ArrowLeft size={19} /></button>
          <div><button className="round-button" onClick={() => toast("공유 링크를 복사했어요")}><Send size={17} /></button><button className={`round-button ${liked ? "is-liked" : ""}`} onClick={onToggleLike}><Heart size={17} fill={liked ? "currentColor" : "none"} /></button></div>
        </div>
        <div className="detail-hero-copy"><StatusPill tone={listing.tagTone}>{listing.tag}</StatusPill><p>{listing.location}</p></div>
      </div>

      <main className="detail-body">
        <div className="detail-title-row">
          <div><h1>{listing.title}</h1><p className="detail-price">{listing.price}</p></div>
          <span className="verified-badge"><ShieldCheck size={15} /> {isTrade ? "거래 정보 확인중" : "검증된 정보"}</span>
        </div>

        {isTrade ? <>
          <div className="trade-badge-row"><StatusPill tone="green">거래 가능</StatusPill><StatusPill tone="sand">가격 협의 가능</StatusPill><span className="trade-updated"><span className="live-dot" /> 12분 전 업데이트</span></div>
          <section className="total-funds-card">
            <div className="funds-heading"><div><p className="eyebrow">거래 요약</p><h2>예상 총 필요자금</h2></div><button onClick={() => setShowAi(true)}><Sparkles size={14} /> 내 자금으로 계산</button></div>
            <strong className="total-funds">{funds ? formatWon(funds.totalRequired) : "확인 중"}</strong>
            <div className="funds-breakdown"><div><span>분양가</span><b>{presale ? formatWon(presale.salePrice) : "확인 중"}</b></div><div><span>프리미엄</span><b className="accent-number">{presale ? `+${formatWon(presale.premium)}` : "확인 중"}</b></div><div><span>옵션·확장비</span><b>{presale ? formatWon(presale.optionCost) : "확인 중"}</b></div></div>
            <p className="funds-caption"><CircleHelp size={13} /> 취득세·중개보수는 포함되지 않은 예상 금액이에요.</p>
          </section>

          <section className="detail-section payment-section"><SectionHeader eyebrow="자금 계획" title="납부 일정" action="내 자금 입력" onAction={() => setShowAi(true)} /><div className="payment-timeline"><div className="payment-step done"><span className="payment-node"><Check size={12} /></span><div><span>계약 시</span><strong>{funds ? formatWon(funds.atContract) : "확인 중"}</strong><small>프리미엄 포함 · 준비 완료</small></div></div><div className="payment-step current"><span className="payment-node" /><div><span>중도금 승계</span><strong>{presale ? formatWon(presale.paidAmount) : "확인 중"}</strong><small>{complex ? `${complex.moveInMonth.slice(0, 4)}. ${complex.moveInMonth.slice(5)} · 납부 내역` : "납부 내역"}</small></div></div><div className="payment-step"><span className="payment-node" /><div><span>잔금 · 입주</span><strong>{funds ? formatWon(funds.remaining) : "확인 중"}</strong><small>{complex ? `${complex.moveInMonth.slice(0, 4)}. ${complex.moveInMonth.slice(5)} · 입주 예정` : "입주 예정"}</small></div></div></div></section>

          {presale?.trust && (
            <TrustReportView
              report={presale.trust}
              onShowCriteria={() => toast("안전도 산정 기준을 확인했어요")}
            />
          )}

          <section className="detail-section document-section"><SectionHeader eyebrow="서류 상태" title="계약 전 꼭 확인할 것" action="전체보기" onAction={() => setShowDoc(true)} /><div className="document-card"><div className="document-icon"><FileCheck2 size={18} /></div><div><strong>확인된 서류 {verifiedDocumentCount} / 3</strong><p>{verifiedDocumentNames || "확인된 서류가 없어요"}</p></div><span className="document-progress"><span /></span></div></section>

          <section className="seller-card"><div className="seller-avatar-large">{sellerInitial}</div><div className="seller-copy"><p className="eyebrow">매도자 신뢰도</p><strong>{presale ? `${presale.seller.identityVerified ? "안심 판매자" : "거래 확인 필요 판매자"} · ${presale.seller.nickname}` : "판매자 확인 중"}</strong><span><ShieldCheck size={12} /> {presale ? `${presale.seller.identityVerified ? "본인 인증" : "본인 인증 필요"} · 거래 이력 ${presale.seller.tradeCount}건` : "판매자 정보를 확인 중이에요"}</span></div><ChevronRight size={16} /></section>
        </> : <>
          <div className="detail-stats"><div><span>전용면적</span><strong>59.86㎡</strong></div><div><span>층수</span><strong>최고 29층</strong></div><div><span>등록일</span><strong>{listing.date}</strong></div></div><section className="detail-section"><SectionHeader title="공고 설명" /><p className="detail-description">청약 일정과 자격 조건을 한눈에 확인할 수 있는 공고입니다. 나의 청약 프로필을 기준으로 신청 가능성을 먼저 살펴보고 필요한 서류를 미리 준비해보세요.</p></section><section className="detail-section"><SectionHeader title="주요 정보" /><div className="info-grid"><div><span>입주 예정</span><strong>2028년 2월</strong></div><div><span>분양가</span><strong>8억 2,400만</strong></div><div><span>청약 일정</span><strong>11. 24 ~ 11. 26</strong></div><div><span>공급 규모</span><strong>총 512세대</strong></div></div></section><button className="safety-note score-entry" onClick={() => setShowScore(true)}><Calculator size={19} /><div><strong>내 청약 가점 계산하기</strong><p>무주택기간 · 부양가족수 · 통장 가입기간으로 가점을 계산해요.</p></div><ChevronRight size={16} /></button><div className="safety-note"><ShieldCheck size={19} /><div><strong>청약 서류를 미리 준비하세요</strong><p>집콕 AI가 내 프로필 기준 필요 서류를 정리해드려요.</p></div><ChevronRight size={16} /></div>
        </>}
      </main>

      <div className={`detail-actions ${isTrade ? "trade-actions" : ""}`}>
        {isTrade && !isMine && <button className="action-offer" onClick={() => setShowOffer(true)}><Tag size={17} /><span>가격 제안</span></button>}
        {isTrade && <button className="action-primary" onClick={isMine ? onOpenInquiries : onGoChat}><MessageCircle size={18} /><span>{isMine ? `문의 ${inquiryCount}건` : "판매자와 채팅"}</span></button>}
        {!isTrade && <button className="action-ai" onClick={() => setShowAi(true)}><Bot size={18} /><span>AI한테 물어보기</span></button>}
        {!isTrade && <button className="action-doc" onClick={() => setShowDoc(true)}><FileCheck2 size={18} /><span>계약서류 AI 점검</span></button>}
        {isTrade && match && <button className="action-match" onClick={() => setShowMatch(true)}><Handshake size={18} /><span>조건 맞춰보기</span></button>}
      </div>

      {showOffer && <div className="sheet-backdrop" onClick={() => setShowOffer(false)}><div className="bottom-sheet offer-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="offer-badge"><Tag size={18} /></div><div><span className="eyebrow">안전한 가격 제안</span><h2>판매자에게 제안할 금액을 입력하세요.</h2></div><button onClick={() => setShowOffer(false)}><X size={18} /></button></div><div className="offer-price-box"><span>현재 총 매수가</span><strong>{funds ? formatWon(funds.totalRequired) : "확인 중"}</strong><div><span>내 제안가</span><b>{offerParts ? offerParts.head : "확인 중"} <em>{offerParts?.tail}</em></b></div></div><button className="upload-button" onClick={() => { setShowOffer(false); if (offerAmount) onSendOffer?.(offerAmount); }}>가격 제안 보내기</button><div className="sheet-footnote"><ShieldCheck size={14} /> 상대방에게는 제안가와 메시지만 전달돼요.</div></div></div>}
      {showAi && <div className="sheet-backdrop" onClick={() => setShowAi(false)}><div className="bottom-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="ai-badge"><Bot size={18} /></div><div><span className="eyebrow">집콕 AI 거래 분석</span><h2>{isTrade ? "이 거래, 지금 진행해도 될까요?" : "이 공고, 나에게 맞을까요?"}</h2></div><button onClick={() => setShowAi(false)}><X size={18} /></button></div>
      {isTrade && roi && <div className="roi-calc">
        <div className="roi-field"><span>보유 예정</span><div className="filter-row">{[6, 12, 24].map((months) => <button key={months} className={`filter-chip ${roiMonths === months ? "active" : ""}`} onClick={() => setRoiMonths(months)}>{months}개월</button>)}</div></div>
        <div className="roi-field"><span>프리미엄 상승 기대</span><div className="filter-row">{[{ label: "보수적", value: 0.003 }, { label: "보통", value: 0.006 }, { label: "공격적", value: 0.01 }].map((option) => <button key={option.label} className={`filter-chip ${roiGrowth === option.value ? "active" : ""}`} onClick={() => setRoiGrowth(option.value)}>{option.label}</button>)}</div></div>
        <div className="roi-result">
          <div><span>예상 매도가</span><b>{formatWon(roi.expectedSalePrice)}</b></div>
          <div><span>양도차익</span><b>{formatWon(roi.gain)}</b></div>
          <div><span>예상 양도세 ({formatRate(roi.taxRate)})</span><b>-{formatWon(roi.tax)}</b></div>
          <div className="roi-highlight"><span>세후 예상 수익</span><strong>{formatWon(roi.netGain)}</strong></div>
          <div className="roi-highlight"><span>투자 대비 수익률</span><strong>{formatRate(roi.netReturnRate)}</strong></div>
        </div>
        <p className="roi-caption"><CircleHelp size={13} /> 프리미엄 상승률 가정에 따른 예상치이며 실제 세금과 다를 수 있어요.</p>
      </div>}
      <div className="question-list"><button onClick={() => toast("AI가 자금 계획을 정리하고 있어요")}>내 자금으로 가능한 거래일까?<ChevronRight size={16} /></button><button onClick={() => toast("AI가 주변 거래가를 비교하고 있어요")}>프리미엄이 적정한지 비교해줘<ChevronRight size={16} /></button><button onClick={() => toast("AI가 계약 리스크를 분석하고 있어요")}>계약할 때 주의할 점은?<ChevronRight size={16} /></button></div><div className="ai-input"><span>매물에 대해 자유롭게 물어보세요</span><button><Send size={16} /></button></div></div></div>}
      {showDoc && <div className="sheet-backdrop" onClick={() => setShowDoc(false)}><div className="bottom-sheet doc-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="doc-badge"><FileCheck2 size={18} /></div><div><span className="eyebrow">서류 안전 점검</span><h2>{isTrade ? "확인할 서류를 선택하세요." : "계약서류를 올려주세요."}</h2></div><button onClick={() => setShowDoc(false)}><X size={18} /></button></div><p>{isTrade ? "분양계약서와 납부확인서를 올리면 집콕 AI가 권리관계와 특약을 먼저 체크해드려요." : "필요 서류와 자격 조건을 AI가 먼저 정리해드려요."}</p><button className="upload-button" onClick={() => toast("파일 선택 기능을 준비 중이에요")}><Plus size={18} />계약서류 업로드</button><div className="sheet-footnote"><ShieldCheck size={14} /> 업로드한 서류는 점검 후 안전하게 삭제돼요.</div></div></div>}
      {showScore && <div className="sheet-backdrop" onClick={() => setShowScore(false)}><div className="bottom-sheet score-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="score-badge"><Calculator size={18} /></div><div><span className="eyebrow">청약 가점 계산기</span><h2>{score.total}점 / {SUBSCRIPTION_SCORE_MAX}점</h2></div><button onClick={() => setShowScore(false)}><X size={18} /></button></div><div className="roi-field"><span>무주택기간</span><div className="filter-row">{HOMELESS_YEARS_OPTIONS.map((option) => <button key={option.label} className={`filter-chip ${homelessYears === option.years ? "active" : ""}`} onClick={() => setHomelessYears(option.years)}>{option.label}</button>)}</div></div><div className="roi-field"><span>부양가족수</span><div className="filter-row">{DEPENDENTS_OPTIONS.map((option) => <button key={option.label} className={`filter-chip ${dependents === option.count ? "active" : ""}`} onClick={() => setDependents(option.count)}>{option.label}</button>)}</div></div><div className="roi-field"><span>청약통장 가입기간</span><div className="filter-row">{ACCOUNT_YEARS_OPTIONS.map((option) => <button key={option.label} className={`filter-chip ${accountYears === option.years ? "active" : ""}`} onClick={() => setAccountYears(option.years)}>{option.label}</button>)}</div></div><div className="roi-result"><div><span>무주택기간 점수</span><b>{score.homelessScore}점</b></div><div><span>부양가족수 점수</span><b>{score.dependentsScore}점</b></div><div><span>청약통장 가입기간 점수</span><b>{score.accountScore}점</b></div><div className="roi-highlight"><span>합계</span><strong>{score.total}점 / {SUBSCRIPTION_SCORE_MAX}점</strong></div></div><div className="sheet-footnote"><ShieldCheck size={14} /> 실제 가점은 세대 구성과 지역 기준에 따라 달라질 수 있어요.</div></div></div>}
      {showMatch && match && presale && <div className="sheet-backdrop" onClick={() => setShowMatch(false)}><div className="bottom-sheet match-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="match-badge"><Handshake size={18} /></div><div><span className="eyebrow">거래 조건 맞춰보기</span><h2>{match.rate}% 맞는 거래예요</h2></div><button onClick={() => setShowMatch(false)}><X size={18} /></button></div><div className="trust-compare"><div className="trust-compare-side"><span className="eyebrow">나</span><strong>{currentBuyer.identityVerified ? "본인 인증 완료" : "본인 인증 필요"}</strong><span>거래 이력 {currentBuyer.tradeCount}건</span></div><div className="trust-compare-side"><span className="eyebrow">판매자</span><strong>{presale.seller.identityVerified ? "본인 인증 완료" : "본인 인증 필요"}</strong><span>거래 이력 {presale.seller.tradeCount}건</span></div></div><div className="match-item-list">{match.items.map((item) => <div className={`match-item ${item.status}`} key={item.label}><span className="match-item-icon">{item.status === "match" ? <Check size={12} /> : <X size={12} />}</span><div><b>{item.label}</b><span>나 {item.buyerValue} · 상대 {item.sellerValue}</span></div></div>)}</div><button className="upload-button" onClick={() => { setShowMatch(false); onGoChat(); }}>채팅 시작하기</button><div className="sheet-footnote"><ShieldCheck size={14} /> 본인인증 정보는 서로에게 요약해서만 보여져요.</div></div></div>}
    </div>
  );
}
