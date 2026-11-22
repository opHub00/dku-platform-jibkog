import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Calculator,
  FileCheck2,
  Handshake,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Tab, Listing } from "@/types";
import { listings } from "@/data/listings";
import { Logo } from "@/components/common/Logo";
import { StatusPill } from "@/components/common/StatusPill";
import { SectionHeader } from "@/components/common/SectionHeader";
import { BottomNav } from "@/components/common/BottomNav";
import { ListingCard } from "@/components/common/ListingCard";
import { ListingsView } from "@/pages/Listings";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { calcFundsBreakdown } from "@/features/presale/lib/funds";
import { formatWon, formatRate } from "@/features/presale/lib/format";
import { toListing } from "@/features/presale/lib/toListing";
import { RegisterListingFlow } from "@/features/presale/components/RegisterListingFlow";
import { TrustReportView } from "@/features/presale/components/TrustReportView";
import { currentBuyer } from "@/features/presale/data/currentBuyer";
import { calcMatchSummary } from "@/features/presale/lib/match";
import { calcRoi } from "@/features/presale/lib/roi";
import {
  ACCOUNT_YEARS_OPTIONS,
  DEPENDENTS_OPTIONS,
  HOMELESS_YEARS_OPTIONS,
  SUBSCRIPTION_SCORE_MAX,
  calcSubscriptionScore,
} from "@/features/presale/lib/subscriptionScore";
import type { PresaleListing } from "@/features/presale/types";

function HomeView({ listings: homeListings, onOpenListing, onGoListings, onGoChat }: { listings: Listing[]; onOpenListing: (listing: Listing) => void; onGoListings: () => void; onGoChat: () => void }) {
  const tradeListings = homeListings.filter((item) => item.type === "trade");
  return (
    <div className="screen-content">
      <header className="topbar">
        <div>
          <Logo />
          <button className="location-button"><MapPin size={13} /> 서울 · 서초구 <ChevronRight size={13} /></button>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="검색"><Search size={19} /></button>
          <button className="icon-button has-badge" aria-label="알림" onClick={() => toast("새로운 맞춤 알림 2건이 있어요") }><Bell size={19} /><span /></button>
        </div>
      </header>

      <main className="home-main">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">오늘의 집콕</p>
            <h1>예나님에게 맞는<br /><span>다음 집</span>을 찾아봤어요.</h1>
          </div>
          <div className="mini-avatar">예나</div>
        </section>

        <section className="recommendation-banner" onClick={() => tradeListings[0] && onOpenListing(tradeListings[0])}>
          <img src="/assets/apt-city.jpg" alt="서울 아파트 전경" />
          <div className="banner-overlay" />
          <div className="banner-content">
            <div className="banner-top"><StatusPill tone="green">관심지역 추천</StatusPill><span>서초구 · 3건</span></div>
            <h2>반포에서 새로 나온<br />분양권을 확인해보세요.</h2>
            <span className="banner-link">거래 매물 보기 <ChevronRight size={15} /></span>
          </div>
        </section>

        <section className="quick-insight">
          <div className="insight-icon"><Sparkles size={17} /></div>
          <div><strong>내 조건에 맞는 새 매물 3건</strong><p>오늘 등록된 매물 중 2건이 청약 가점에 맞아요.</p></div>
          <button onClick={onGoListings} aria-label="매물 보기"><ChevronRight size={17} /></button>
        </section>

        <section>
          <SectionHeader eyebrow="맞춤 알림" title="놓치면 아쉬운 소식" action="전체보기" onAction={() => toast("맞춤 알림 전체보기를 준비 중이에요")} />
          <div className="alert-list">
            <div className="alert-row"><span className="alert-dot green-dot" /><div><strong>관심지역에 새 거래가 올라왔어요</strong><p>래미안 원베일리 · 프리미엄 3.2억</p></div><span className="alert-time">10분 전</span></div>
            <div className="alert-row"><span className="alert-dot sand-dot" /><div><strong>청약 일정이 곧 시작돼요</strong><p>마곡나루역 오피스텔 · 11월 24일</p></div><span className="alert-time">어제</span></div>
          </div>
        </section>

        <section className="home-listings-section">
          <SectionHeader eyebrow="관심지역 거래" title="지금 보고 있는 매물" action="더보기" onAction={onGoListings} />
          <div className="horizontal-cards">
            {tradeListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}
          </div>
        </section>

        <button className="chat-fab" onClick={onGoChat}><Bot size={17} /><span>AI 상담</span></button>
      </main>
    </div>
  );
}

function DetailView({ listing, liked, onBack, onToggleLike, onGoChat }: { listing: Listing; liked: boolean; onBack: () => void; onToggleLike: () => void; onGoChat: () => void }) {
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
        <button className="action-secondary" onClick={onToggleLike}><Heart size={18} fill={liked ? "currentColor" : "none"} /><span>{liked ? "찜한 매물" : "찜하기"}</span></button>
        {isTrade && <button className="action-offer" onClick={() => setShowOffer(true)}><Tag size={17} /><span>가격 제안</span></button>}
        {isTrade && <button className="action-primary" onClick={onGoChat}><MessageCircle size={18} /><span>판매자와 채팅</span></button>}
        <button className="action-ai" onClick={() => setShowAi(true)}><Bot size={18} /><span>{isTrade ? "이 매물 분석하기" : "AI한테 물어보기"}</span></button>
        <button className="action-doc" onClick={() => setShowDoc(true)}><FileCheck2 size={18} /><span>계약서류 AI 점검</span></button>
        {isTrade && match && <button className="action-match" onClick={() => setShowMatch(true)}><Handshake size={18} /><span>조건 맞춰보기</span></button>}
      </div>

      {showOffer && <div className="sheet-backdrop" onClick={() => setShowOffer(false)}><div className="bottom-sheet offer-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="offer-badge"><Tag size={18} /></div><div><span className="eyebrow">안전한 가격 제안</span><h2>판매자에게 제안할 금액을 입력하세요.</h2></div><button onClick={() => setShowOffer(false)}><X size={18} /></button></div><div className="offer-price-box"><span>현재 총 매수가</span><strong>{funds ? formatWon(funds.totalRequired) : "확인 중"}</strong><div><span>내 제안가</span><b>24억 <em>6,000만</em></b></div></div><button className="upload-button" onClick={() => { setShowOffer(false); toast("가격 제안을 판매자에게 보냈어요"); }}>가격 제안 보내기</button><div className="sheet-footnote"><ShieldCheck size={14} /> 상대방에게는 제안가와 메시지만 전달돼요.</div></div></div>}
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

function ChatView({ listings: chatListings, onOpenListing }: { listings: Listing[]; onOpenListing: (listing: Listing) => void }) {
  const tradeListings = chatListings.filter((listing) => listing.type === "trade");
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">대화</p><h1>채팅</h1></div><button className="icon-button"><Search size={19} /></button></header><main className="chat-main"><button className="ai-thread" onClick={() => toast("AI 상담 스레드를 열었어요")}><div className="thread-avatar ai-avatar"><Bot size={20} /></div><div className="thread-copy"><div><strong>AI 상담</strong><StatusPill tone="green">고정</StatusPill></div><p>내 조건에 맞는 청약과 거래를 찾아드릴게요.</p></div><span className="thread-time">지금</span><ChevronRight size={17} /></button><div className="chat-divider"><span>분양권 거래</span><span>{tradeListings.length}개</span></div><div className="chat-list">{tradeListings.slice(0, 2).map((listing, index) => <button key={listing.id} className="chat-row" onClick={() => onOpenListing(listing)}><div className="thread-avatar seller-avatar">{listing.presale?.seller.realName.slice(0, 2) ?? "판매"}</div><div className="thread-copy"><div><strong>{listing.title} · 판매자</strong><StatusPill tone={index === 0 ? "green" : "navy"}>{index === 0 ? "진행중" : "완료"}</StatusPill></div><p>{index === 0 ? "안녕하세요. 문의하신 동·호수 확인했어요." : "계약서류 점검 결과를 확인해보세요."}</p></div><div className="chat-meta"><span>{index === 0 ? "10:42" : "어제"}</span>{index === 0 && <b>2</b>}</div></button>)}</div><div className="chat-tip"><CircleHelp size={17} /><div><strong>거래 채팅은 안심번호로 보호돼요</strong><p>상대방과 주고받은 서류는 계약서류 점검 이력에 저장됩니다.</p></div></div></main></div>;
}

function FavoritesView({ listings: favoriteListings, onOpenListing, onToggleLike, onOpenRegister }: { listings: Listing[]; onOpenListing: (listing: Listing) => void; onToggleLike: (listing: Listing) => void; onOpenRegister: () => void }) {
  const [segment, setSegment] = useState<"saved" | "posted">("saved");
  const savedListings = favoriteListings.filter((listing) => listing.liked);
  const postedListings = favoriteListings.filter((listing) => listing.type === "trade");
  const postedListing = postedListings[0];
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">내 공간</p><h1>관심</h1></div><button className="icon-button"><MoreHorizontal size={20} /></button></header><main className="favorites-main"><div className="segment-control"><button className={segment === "saved" ? "active" : ""} onClick={() => setSegment("saved")}>찜한 매물 <span>{savedListings.length}</span></button><button className={segment === "posted" ? "active" : ""} onClick={() => setSegment("posted")}>내가 등록한 매물 <span>{postedListings.length}</span></button></div>{segment === "saved" ? <div className="favorite-stack">{savedListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => onToggleLike(listing)} />)}</div> : <div className="posted-view"><div className="posted-summary"><div><span className="eyebrow">판매 중인 매물</span><strong>{postedListings.length}건</strong><p>관심 있는 구매자와 대화를 시작해보세요.</p></div><div className="posted-chart"><span /><span /><span /><span /><span /></div></div>{postedListing && <div className="posted-card" onClick={() => onOpenListing(postedListing)}><div className="posted-card-image"><img src={postedListing.image} alt="" /><StatusPill tone="green">{postedListing.presale?.status === "review" ? "검토중" : "거래중"}</StatusPill></div><div><div className="listing-meta"><span>{postedListing.location}</span><span>조회 24</span></div><h3>{postedListing.title}</h3><strong className="listing-price">{postedListing.price}</strong><div className="posted-actions"><button onClick={(event) => { event.stopPropagation(); toast("등록 매물을 수정할 수 있어요"); }}>수정</button><button onClick={(event) => { event.stopPropagation(); toast("매물 통계를 확인했어요"); }}>통계 보기</button></div></div></div>}</div>}<button className="add-listing-button" onClick={onOpenRegister}><Plus size={18} /><span>{segment === "posted" ? "새 매물 등록하기" : "내 매물 등록하기"}</span><ChevronRight size={16} /></button></main></div>;
}

function MyView() {
  const menuItems = [
    { icon: <UserRound size={18} />, label: "프로필 · 관심지역 설정", detail: "서울 서초구 · 무주택 3년" },
    { icon: <Bell size={18} />, label: "알림 구독 관리", detail: "청약 3개 · 거래 2개" },
    { icon: <FileCheck2 size={18} />, label: "계약서류 점검 이력", detail: "최근 점검 2건" },
    { icon: <WalletCards size={18} />, label: "멤버십 관리", detail: "집콕 프리미엄 이용 중" },
  ];
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">내 정보</p><h1>MY</h1></div><button className="icon-button"><SlidersHorizontal size={19} /></button></header><main className="my-main"><div className="profile-card"><div className="profile-top"><div className="profile-avatar">예나</div><div><h2>주예나님</h2><p>가입일 2026. 04. 18</p></div><button onClick={() => toast("프로필 편집을 준비 중이에요")}><MoreHorizontal size={19} /></button></div><div className="profile-divider" /><div className="profile-stats"><div><span>청약 가점</span><strong>62점</strong></div><div><span>관심지역</span><strong>3곳</strong></div><div><span>찜한 매물</span><strong>2건</strong></div></div></div><div className="my-section"><SectionHeader eyebrow="관리" title="내 설정" /><div className="my-menu">{menuItems.map((item) => <button key={item.label} className="my-menu-row" onClick={() => toast(`${item.label} 화면을 준비 중이에요`)}><div className="my-menu-icon">{item.icon}</div><div><strong>{item.label}</strong><span>{item.detail}</span></div><ChevronRight size={16} /></button>)}</div></div><div className="membership-card"><div className="membership-icon"><Sparkles size={18} /></div><div><span className="eyebrow">집콕 프리미엄</span><strong>계약서류 AI 점검을 무제한으로</strong><p>다음 결제일 2026. 12. 18</p></div><button onClick={() => toast("멤버십 관리 화면을 준비 중이에요")}><ChevronRight size={16} /></button></div><div className="my-footer"><span>버전 1.0.0</span><button>이용약관</button><button>개인정보처리방침</button></div></main></div>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const noticeListings = listings.filter((listing) => listing.type === "notice");
  const [homeListings, setHomeListings] = useState<Listing[]>(noticeListings);
  const [postedListings, setPostedListings] = useState<Listing[]>([]);
  const [likedIds, setLikedIds] = useState<number[]>(noticeListings.filter((listing) => listing.liked).map((listing) => listing.id));

  useEffect(() => {
    let active = true;
    const reloadListings = async () => {
      const [visiblePresaleListings, allPresaleListings, complexes, currentSeller] = await Promise.all([
        presaleRepository.listListings(),
        presaleRepository.listListings({ includeHidden: true }),
        presaleRepository.listComplexes(),
        presaleRepository.getCurrentSeller(),
      ]);
      if (!active) return;
      const complexById = new Map(complexes.map((complex) => [complex.id, complex]));
      const toUiListings = (presaleListings: PresaleListing[]) =>
        presaleListings
          .map((listing) => {
            const complex = complexById.get(listing.complexId);
            return complex ? toListing(listing, complex) : null;
          })
          .filter((listing): listing is Listing => listing !== null);
      const visibleTradeListings = toUiListings(visiblePresaleListings);
      const allTradeListings = toUiListings(allPresaleListings);
      setHomeListings([...visibleTradeListings, ...noticeListings]);
      setPostedListings(
        allTradeListings.filter(
          (listing) =>
            listing.presale?.seller.realName === currentSeller.realName,
        ),
      );
      setLikedIds([
        ...allTradeListings.filter((listing) => listing.liked).map((listing) => listing.id),
        ...noticeListings.filter((listing) => listing.liked).map((listing) => listing.id),
      ]);
    };
    void reloadListings();
    const unsubscribe = presaleRepository.subscribe(() => void reloadListings());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const openListing = (listing: Listing) => setSelectedListing(listing);
  const toggleListingLike = (listing: Listing) => {
    if (listing.type === "trade") {
      void presaleRepository.toggleLike(listing.id).then((updated) => {
        setLikedIds((current) => updated.liked
          ? [...current.filter((id) => id !== updated.id), updated.id]
          : current.filter((id) => id !== updated.id));
        toast(updated.liked ? "관심 매물에 저장했어요" : "관심 매물에서 삭제했어요");
      });
      return;
    }
    setLikedIds((current) => current.includes(listing.id)
      ? current.filter((id) => id !== listing.id)
      : [...current, listing.id]);
    toast(likedIds.includes(listing.id) ? "관심 매물에서 삭제했어요" : "관심 매물에 저장했어요");
  };
  const toggleLike = () => {
    if (selectedListing) toggleListingLike(selectedListing);
  };
  const goChat = () => { setSelectedListing(null); setActiveTab("chat"); };
  const goListings = () => { setSelectedListing(null); setActiveTab("listings"); };
  const openRegister = () => setShowRegister(true);
  const handleRegistered = async (created: PresaleListing) => {
    const complex = await presaleRepository.getComplex(created.complexId);
    if (!complex) return;
    setShowRegister(false);
    setActiveTab("favorites");
    setSelectedListing(toListing(created, complex));
  };

  if (showRegister) {
    return (
      <div className="app-frame">
        <RegisterListingFlow
          onClose={() => setShowRegister(false)}
          onRegistered={(created) => void handleRegistered(created)}
        />
      </div>
    );
  }

  if (selectedListing) {
    const currentListing = { ...selectedListing, liked: likedIds.includes(selectedListing.id) };
    return <div className="app-frame"><DetailView listing={currentListing} liked={currentListing.liked ?? false} onBack={() => setSelectedListing(null)} onToggleLike={toggleLike} onGoChat={goChat} /></div>;
  }

  const favoriteListings = [...postedListings, ...homeListings.filter((listing) => listing.type === "notice")];
  const content = activeTab === "home" ? <HomeView listings={homeListings} onOpenListing={openListing} onGoListings={goListings} onGoChat={goChat} /> : activeTab === "listings" ? <ListingsView onOpenListing={openListing} /> : activeTab === "chat" ? <ChatView listings={homeListings} onOpenListing={openListing} /> : activeTab === "favorites" ? <FavoritesView listings={favoriteListings} onOpenListing={openListing} onToggleLike={toggleListingLike} onOpenRegister={openRegister} /> : <MyView />;
  return <div className="app-frame">{content}<BottomNav active={activeTab} onChange={setActiveTab} /></div>;
}
