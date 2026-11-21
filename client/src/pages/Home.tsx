import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  Heart,
  Map,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
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
import type { Tab, ListingType, Listing } from "@/types";
import { Logo } from "@/components/common/Logo";
import { StatusPill } from "@/components/common/StatusPill";
import { SectionHeader } from "@/components/common/SectionHeader";
import { BottomNav } from "@/components/common/BottomNav";
import { ListingCard } from "@/components/common/ListingCard";

type ViewMode = "map" | "list";

const listings: Listing[] = [
  {
    id: 1,
    type: "trade",
    title: "래미안 원베일리 84㎡",
    location: "서울 서초구 반포동",
    price: "24억 8,000만",
    detail: "입주 예정 2027. 08 · 프리미엄 3.2억",
    date: "방금 전",
    image: "/assets/apt-seoul.webp",
    tag: "분양권 거래",
    tagTone: "green",
    liked: true,
    urgent: true,
  },
  {
    id: 2,
    type: "notice",
    title: "마곡나루역 오피스텔 청약",
    location: "서울 강서구 마곡동",
    price: "청약 예정",
    detail: "신청 11. 24 ~ 11. 26 · 총 512세대",
    date: "오늘",
    image: "/assets/modern-home.jpg",
    tag: "청약공고",
    tagTone: "navy",
  },
  {
    id: 3,
    type: "trade",
    title: "과천 디에트르 퍼스티지 59㎡",
    location: "경기 과천시 별양동",
    price: "12억 4,000만",
    detail: "입주 예정 2026. 10 · 프리미엄 1.1억",
    date: "어제",
    image: "/assets/apt-city.jpg",
    tag: "분양권 거래",
    tagTone: "green",
    liked: true,
  },
  {
    id: 4,
    type: "notice",
    title: "검단신도시 AA21블록",
    location: "인천 서구 원당동",
    price: "청약 예정",
    detail: "신청 11. 27 ~ 11. 29 · 총 1,122세대",
    date: "어제",
    image: "/assets/modern-home.jpg",
    tag: "청약공고",
    tagTone: "navy",
  },
];

const newsItems = [
  { category: "청약 인사이트", title: "11월 셋째 주, 수도권 청약 일정 한눈에 보기", time: "3시간 전" },
  { category: "시장 브리핑", title: "분양권 거래량이 다시 움직이기 시작한 지역 3곳", time: "어제" },
  { category: "알아두면 좋은 것", title: "계약 전 확인해야 할 옵션·중도금 체크리스트", time: "11. 17" },
];

function HomeView({ onOpenListing, onGoListings, onGoChat }: { onOpenListing: (listing: Listing) => void; onGoListings: () => void; onGoChat: () => void }) {
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

        <section className="recommendation-banner" onClick={() => onOpenListing(listings[0])}>
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

        <section>
          <SectionHeader eyebrow="부동산 뉴스" title="오늘의 시장 브리핑" action="더보기" onAction={() => toast("뉴스 전체보기를 준비 중이에요")} />
          <div className="news-list">
            {newsItems.map((news, index) => <article className="news-row" key={news.title}><div className={`news-number number-${index + 1}`}>{String(index + 1).padStart(2, "0")}</div><div><span>{news.category}</span><h3>{news.title}</h3><p>{news.time}</p></div><ChevronRight size={16} /></article>)}
          </div>
        </section>

        <section className="home-listings-section">
          <SectionHeader eyebrow="관심지역 거래" title="지금 보고 있는 매물" action="더보기" onAction={onGoListings} />
          <div className="horizontal-cards">
            {listings.filter((item) => item.type === "trade").map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}
          </div>
        </section>

        <button className="chat-fab" onClick={onGoChat}><Bot size={17} /><span>AI 상담</span></button>
      </main>
    </div>
  );
}

function MapCanvas({ filteredListings, onOpenListing }: { filteredListings: Listing[]; onOpenListing: (listing: Listing) => void }) {
  const pinPositions = [
    { left: "19%", top: "26%" },
    { left: "56%", top: "21%" },
    { left: "72%", top: "55%" },
    { left: "36%", top: "68%" },
  ];
  return (
    <div className="map-canvas">
      <div className="map-grid" />
      <div className="map-water water-one" /><div className="map-water water-two" />
      <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
      <div className="map-label label-one">반포대로</div><div className="map-label label-two">잠원동</div><div className="map-label label-three">고속터미널</div><div className="map-label label-four">서초</div>
      {filteredListings.map((listing, index) => {
        const position = pinPositions[index % pinPositions.length];
        return <button key={listing.id} className={`map-pin ${listing.type === "trade" ? "trade-pin" : "notice-pin"}`} style={position} onClick={() => onOpenListing(listing)}><span>{listing.type === "trade" ? "거래" : "청약"}</span><b>{listing.type === "trade" ? listing.price.split(" ")[0] : "공고"}</b></button>;
      })}
      <div className="map-current"><span /></div>
      <div className="map-scale">현재 위치 기준 · 1.2km</div>
    </div>
  );
}

function ListingsView({ onOpenListing }: { onOpenListing: (listing: Listing) => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [filter, setFilter] = useState<"all" | ListingType>("all");
  const filteredListings = useMemo(() => filter === "all" ? listings : listings.filter((item) => item.type === filter), [filter]);
  const filterOptions = [{ id: "all" as const, label: "전체" }, { id: "notice" as const, label: "청약공고" }, { id: "trade" as const, label: "분양권거래" }];

  return (
    <div className="screen-content">
      <header className="page-header"><div><p className="eyebrow">내 관심지역</p><h1>서울 · 서초구</h1></div><button className="icon-button"><SlidersHorizontal size={19} /></button></header>
      <main className="listing-main">
        <div className="search-bar"><Search size={16} /><span>지역, 단지명으로 찾아보세요</span><button><SlidersHorizontal size={16} /></button></div>
        <div className="filter-row">{filterOptions.map((option) => <button key={option.id} className={`filter-chip ${filter === option.id ? "active" : ""}`} onClick={() => setFilter(option.id)}>{option.label}<span>{option.id === "all" ? listings.length : listings.filter((item) => item.type === option.id).length}</span></button>)}</div>
        <div className="listing-toolbar"><span><strong>{filteredListings.length}개</strong>의 매물이 있어요</span><div className="view-toggle"><button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}><Map size={15} />지도</button><button className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}><MoreHorizontal size={15} />목록</button></div></div>
        {viewMode === "map" ? <MapCanvas filteredListings={filteredListings} onOpenListing={onOpenListing} /> : <div className="listing-stack">{filteredListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} />)}</div>}
        {viewMode === "map" && <div className="map-bottom-list"><div className="map-bottom-heading"><span>지도에서 보고 있는 매물</span><button onClick={() => setViewMode("list")}>목록으로 <ChevronRight size={14} /></button></div>{filteredListings.slice(0, 2).map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}</div>}
      </main>
    </div>
  );
}

function DetailView({ listing, liked, onBack, onToggleLike, onGoChat }: { listing: Listing; liked: boolean; onBack: () => void; onToggleLike: () => void; onGoChat: () => void }) {
  const [showAi, setShowAi] = useState(false);
  const [showDoc, setShowDoc] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const isTrade = listing.type === "trade";

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
            <strong className="total-funds">23억 1,000만</strong>
            <div className="funds-breakdown"><div><span>분양가</span><b>19억 6,000만</b></div><div><span>프리미엄</span><b className="accent-number">+3억 2,000만</b></div><div><span>옵션·확장비</span><b>3,000만</b></div></div>
            <p className="funds-caption"><CircleHelp size={13} /> 취득세·중개보수는 포함되지 않은 예상 금액이에요.</p>
          </section>

          <section className="detail-section payment-section"><SectionHeader eyebrow="자금 계획" title="납부 일정" action="내 자금 입력" onAction={() => setShowAi(true)} /><div className="payment-timeline"><div className="payment-step done"><span className="payment-node"><Check size={12} /></span><div><span>계약 시</span><strong>3억 2,000만</strong><small>프리미엄 포함 · 준비 완료</small></div></div><div className="payment-step current"><span className="payment-node" /><div><span>중도금 승계</span><strong>8억 4,000만</strong><small>2026. 12 · 4회차</small></div></div><div className="payment-step"><span className="payment-node" /><div><span>잔금 · 입주</span><strong>11억 5,000만</strong><small>2027. 08 · 입주 예정</small></div></div></div></section>

          <section className="detail-section safety-section"><div className="section-header"><div><p className="eyebrow">집콕 검증 리포트</p><h2>거래 안전도 <span className="score-highlight">82점</span></h2></div><button className="report-link" onClick={() => toast("안전도 산정 기준을 확인했어요")}>산정 기준 <ChevronRight size={14} /></button></div><div className="safety-meter"><div className="meter-track"><span /></div><strong>안전한 편</strong></div><div className="verification-list"><div><span className="check-icon"><Check size={12} /></span><div><b>판매자 본인 인증</b><small>휴대폰·신분증 인증 완료</small></div><StatusPill tone="green">확인 완료</StatusPill></div><div><span className="check-icon"><Check size={12} /></span><div><b>분양계약서</b><small>원본 대조 확인 완료</small></div><StatusPill tone="green">확인 완료</StatusPill></div><div><span className="pending-icon">!</span><div><b>중도금 납부내역</b><small>판매자에게 확인이 필요해요</small></div><StatusPill tone="sand">확인 필요</StatusPill></div></div></section>

          <section className="detail-section document-section"><SectionHeader eyebrow="서류 상태" title="계약 전 꼭 확인할 것" action="전체보기" onAction={() => setShowDoc(true)} /><div className="document-card"><div className="document-icon"><FileCheck2 size={18} /></div><div><strong>확인된 서류 3 / 4</strong><p>분양계약서 · 옵션계약서 · 납부확인서</p></div><span className="document-progress"><span /></span></div></section>

          <section className="seller-card"><div className="seller-avatar-large">RB</div><div className="seller-copy"><p className="eyebrow">매도자 신뢰도</p><strong>안심 판매자 · 반포거주자</strong><span><ShieldCheck size={12} /> 본인 인증 · 거래 이력 3건</span></div><ChevronRight size={16} /></section>
        </> : <>
          <div className="detail-stats"><div><span>전용면적</span><strong>59.86㎡</strong></div><div><span>층수</span><strong>최고 29층</strong></div><div><span>등록일</span><strong>{listing.date}</strong></div></div><section className="detail-section"><SectionHeader title="공고 설명" /><p className="detail-description">청약 일정과 자격 조건을 한눈에 확인할 수 있는 공고입니다. 나의 청약 프로필을 기준으로 신청 가능성을 먼저 살펴보고 필요한 서류를 미리 준비해보세요.</p></section><section className="detail-section"><SectionHeader title="주요 정보" /><div className="info-grid"><div><span>입주 예정</span><strong>2028년 2월</strong></div><div><span>분양가</span><strong>8억 2,400만</strong></div><div><span>청약 일정</span><strong>11. 24 ~ 11. 26</strong></div><div><span>공급 규모</span><strong>총 512세대</strong></div></div></section><div className="safety-note"><ShieldCheck size={19} /><div><strong>청약 서류를 미리 준비하세요</strong><p>집콕 AI가 내 프로필 기준 필요 서류를 정리해드려요.</p></div><ChevronRight size={16} /></div>
        </>}
      </main>

      <div className={`detail-actions ${isTrade ? "trade-actions" : ""}`}>
        <button className="action-secondary" onClick={onToggleLike}><Heart size={18} fill={liked ? "currentColor" : "none"} /><span>{liked ? "찜한 매물" : "찜하기"}</span></button>
        {isTrade && <button className="action-offer" onClick={() => setShowOffer(true)}><Tag size={17} /><span>가격 제안</span></button>}
        {isTrade && <button className="action-primary" onClick={onGoChat}><MessageCircle size={18} /><span>판매자와 채팅</span></button>}
        <button className="action-ai" onClick={() => setShowAi(true)}><Bot size={18} /><span>{isTrade ? "이 매물 분석하기" : "AI한테 물어보기"}</span></button>
        <button className="action-doc" onClick={() => setShowDoc(true)}><FileCheck2 size={18} /><span>계약서류 AI 점검</span></button>
      </div>

      {showOffer && <div className="sheet-backdrop" onClick={() => setShowOffer(false)}><div className="bottom-sheet offer-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="offer-badge"><Tag size={18} /></div><div><span className="eyebrow">안전한 가격 제안</span><h2>판매자에게 제안할 금액을 입력하세요.</h2></div><button onClick={() => setShowOffer(false)}><X size={18} /></button></div><div className="offer-price-box"><span>현재 총 매수가</span><strong>24억 8,000만</strong><div><span>내 제안가</span><b>24억 <em>6,000만</em></b></div></div><button className="upload-button" onClick={() => { setShowOffer(false); toast("가격 제안을 판매자에게 보냈어요"); }}>가격 제안 보내기</button><div className="sheet-footnote"><ShieldCheck size={14} /> 상대방에게는 제안가와 메시지만 전달돼요.</div></div></div>}
      {showAi && <div className="sheet-backdrop" onClick={() => setShowAi(false)}><div className="bottom-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="ai-badge"><Bot size={18} /></div><div><span className="eyebrow">집콕 AI 거래 분석</span><h2>{isTrade ? "이 거래, 지금 진행해도 될까요?" : "이 공고, 나에게 맞을까요?"}</h2></div><button onClick={() => setShowAi(false)}><X size={18} /></button></div><div className="question-list"><button onClick={() => toast("AI가 자금 계획을 정리하고 있어요")}>내 자금으로 가능한 거래일까?<ChevronRight size={16} /></button><button onClick={() => toast("AI가 주변 거래가를 비교하고 있어요")}>프리미엄이 적정한지 비교해줘<ChevronRight size={16} /></button><button onClick={() => toast("AI가 계약 리스크를 분석하고 있어요")}>계약할 때 주의할 점은?<ChevronRight size={16} /></button></div><div className="ai-input"><span>매물에 대해 자유롭게 물어보세요</span><button><Send size={16} /></button></div></div></div>}
      {showDoc && <div className="sheet-backdrop" onClick={() => setShowDoc(false)}><div className="bottom-sheet doc-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-heading"><div className="doc-badge"><FileCheck2 size={18} /></div><div><span className="eyebrow">서류 안전 점검</span><h2>{isTrade ? "확인할 서류를 선택하세요." : "계약서류를 올려주세요."}</h2></div><button onClick={() => setShowDoc(false)}><X size={18} /></button></div><p>{isTrade ? "분양계약서와 납부확인서를 올리면 집콕 AI가 권리관계와 특약을 먼저 체크해드려요." : "필요 서류와 자격 조건을 AI가 먼저 정리해드려요."}</p><button className="upload-button" onClick={() => toast("파일 선택 기능을 준비 중이에요")}><Plus size={18} />계약서류 업로드</button><div className="sheet-footnote"><ShieldCheck size={14} /> 업로드한 서류는 점검 후 안전하게 삭제돼요.</div></div></div>}
    </div>
  );
}

function ChatView({ onOpenListing }: { onOpenListing: (listing: Listing) => void }) {
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">대화</p><h1>채팅</h1></div><button className="icon-button"><Search size={19} /></button></header><main className="chat-main"><button className="ai-thread" onClick={() => toast("AI 상담 스레드를 열었어요")}><div className="thread-avatar ai-avatar"><Bot size={20} /></div><div className="thread-copy"><div><strong>AI 상담</strong><StatusPill tone="green">고정</StatusPill></div><p>내 조건에 맞는 청약과 거래를 찾아드릴게요.</p></div><span className="thread-time">지금</span><ChevronRight size={17} /></button><div className="chat-divider"><span>분양권 거래</span><span>2개</span></div><div className="chat-list"><button className="chat-row" onClick={() => onOpenListing(listings[0])}><div className="thread-avatar seller-avatar">RB</div><div className="thread-copy"><div><strong>래미안 원베일리 · 판매자</strong><StatusPill tone="green">진행중</StatusPill></div><p>안녕하세요. 문의하신 동·호수 확인했어요.</p></div><div className="chat-meta"><span>10:42</span><b>2</b></div></button><button className="chat-row" onClick={() => onOpenListing(listings[2])}><div className="thread-avatar seller-avatar">DH</div><div className="thread-copy"><div><strong>과천 디에트르 · 판매자</strong><StatusPill>완료</StatusPill></div><p>계약서류 점검 결과를 확인해보세요.</p></div><div className="chat-meta"><span>어제</span></div></button></div><div className="chat-tip"><CircleHelp size={17} /><div><strong>거래 채팅은 안심번호로 보호돼요</strong><p>상대방과 주고받은 서류는 계약서류 점검 이력에 저장됩니다.</p></div></div></main></div>;
}

function FavoritesView({ onOpenListing }: { onOpenListing: (listing: Listing) => void }) {
  const [segment, setSegment] = useState<"saved" | "posted">("saved");
  const savedListings = listings.filter((listing) => listing.liked);
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">내 공간</p><h1>관심</h1></div><button className="icon-button"><MoreHorizontal size={20} /></button></header><main className="favorites-main"><div className="segment-control"><button className={segment === "saved" ? "active" : ""} onClick={() => setSegment("saved")}>찜한 매물 <span>{savedListings.length}</span></button><button className={segment === "posted" ? "active" : ""} onClick={() => setSegment("posted")}>내가 등록한 매물 <span>1</span></button></div>{segment === "saved" ? <div className="favorite-stack">{savedListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에서 삭제했어요")} />)}</div> : <div className="posted-view"><div className="posted-summary"><div><span className="eyebrow">판매 중인 매물</span><strong>1건</strong><p>관심 있는 구매자와 대화를 시작해보세요.</p></div><div className="posted-chart"><span /><span /><span /><span /><span /></div></div><div className="posted-card"><div className="posted-card-image"><img src="/assets/apt-seoul.webp" alt="" /><StatusPill tone="green">거래중</StatusPill></div><div><div className="listing-meta"><span>서울 서초구 반포동</span><span>조회 24</span></div><h3>래미안 원베일리 84㎡</h3><strong className="listing-price">24억 8,000만</strong><div className="posted-actions"><button onClick={() => toast("등록 매물을 수정할 수 있어요")}>수정</button><button onClick={() => toast("매물 통계를 확인했어요")}>통계 보기</button></div></div></div></div>}<button className="add-listing-button" onClick={() => toast("새 매물 등록 플로우를 준비 중이에요")}><Plus size={18} /><span>{segment === "posted" ? "새 매물 등록하기" : "내 매물 등록하기"}</span><ChevronRight size={16} /></button></main></div>;
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
  const [likedIds, setLikedIds] = useState<number[]>(listings.filter((listing) => listing.liked).map((listing) => listing.id));

  const openListing = (listing: Listing) => setSelectedListing(listing);
  const toggleLike = () => {
    if (!selectedListing) return;
    setLikedIds((current) => current.includes(selectedListing.id) ? current.filter((id) => id !== selectedListing.id) : [...current, selectedListing.id]);
    toast(likedIds.includes(selectedListing.id) ? "관심 매물에서 삭제했어요" : "관심 매물에 저장했어요");
  };
  const goChat = () => { setSelectedListing(null); setActiveTab("chat"); };
  const goListings = () => { setSelectedListing(null); setActiveTab("listings"); };

  if (selectedListing) {
    const currentListing = { ...selectedListing, liked: likedIds.includes(selectedListing.id) };
    return <div className="app-frame"><DetailView listing={currentListing} liked={currentListing.liked ?? false} onBack={() => setSelectedListing(null)} onToggleLike={toggleLike} onGoChat={goChat} /></div>;
  }

  const content = activeTab === "home" ? <HomeView onOpenListing={openListing} onGoListings={goListings} onGoChat={goChat} /> : activeTab === "listings" ? <ListingsView onOpenListing={openListing} /> : activeTab === "chat" ? <ChatView onOpenListing={openListing} /> : activeTab === "favorites" ? <FavoritesView onOpenListing={openListing} /> : <MyView />;
  return <div className="app-frame">{content}<BottomNav active={activeTab} onChange={setActiveTab} /></div>;
}
