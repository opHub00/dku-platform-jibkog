import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  Heart,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import type { Tab, Listing } from "@/types";
import { listings } from "@/data/listings";
import { notifications, type NotificationCategory } from "@/data/notifications";
import { Logo } from "@/components/common/Logo";
import { StatusPill } from "@/components/common/StatusPill";
import { SectionHeader } from "@/components/common/SectionHeader";
import { BottomNav } from "@/components/common/BottomNav";
import { ListingCard } from "@/components/common/ListingCard";
import { ListingsView } from "@/pages/Listings";
import { ListingDetail } from "@/pages/ListingDetail";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { toListing } from "@/features/presale/lib/toListing";
import { RegisterListingFlow } from "@/features/presale/components/RegisterListingFlow";
import type { PresaleListing } from "@/features/presale/types";
import { useLikedPresaleCount } from "@/features/presale/lib/useLikedPresaleCount";
import { ProfileForm } from "@/features/profile/components/ProfileForm";
import { OnboardingScreen } from "@/features/profile/components/OnboardingScreen";
import { useProfile } from "@/features/profile/lib/useProfile";
import { greetingName, interestHeadline, profileSummary, regionKey, shortName } from "@/features/profile/lib/profileText";
import { chatRepository } from "@/features/chat/api/chatRepository";
import { toChatThread } from "@/features/chat/lib/adapters";
import { avatarText, ROLE_LABELS } from "@/features/chat/lib/names";
import { AuthScreen } from "@/features/auth/components/AuthScreen";
import { IdentityVerificationScreen } from "@/features/auth/components/IdentityVerificationScreen";
import { logout, useAuth } from "@/features/auth/lib/session";
import { useAiSessions, useChatRooms } from "@/features/chat/lib/useChat";
import "@/features/chat/chat.css";
import { CHAT_STATUS_LABELS, CHAT_STATUS_TONES } from "@/features/chat/tradeTypes";
import { aiChatRepository } from "@/features/chat/api/aiChatRepository";
import { TradeChatRoom } from "@/features/chat/components/TradeChatRoom";
import { ChatRoomView } from "@/pages/ChatRoom";
import { ChatSessionList } from "@/pages/ChatSessionList";

function HomeView({ listings: homeListings, onOpenListing, onGoListings, onGoChat, onOpenSaved, onOpenNotifications, onOpenListingAlerts, onEditRegions }: { listings: Listing[]; onOpenListing: (listing: Listing) => void; onGoListings: () => void; onGoChat: () => void; onOpenSaved: () => void; onOpenNotifications: () => void; onOpenListingAlerts: () => void; onEditRegions: () => void }) {
  const tradeListings = homeListings.filter((item) => item.type === "trade");
  const listingAlerts = notifications.filter((item) => item.category === "listing");
  const profile = useProfile();
  const firstInterest = profile.interestRegions[0];
  const firstInterestTradeCount = firstInterest
    ? tradeListings.filter((listing) => listing.district === regionKey(firstInterest) && listing.presale?.status === "selling").length
    : 0;
  const [showChatTeaser, setShowChatTeaser] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowChatTeaser(false), 3500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="screen-content">
      <header className="topbar">
        <div>
          <Logo />
          <button className="location-button" onClick={onEditRegions}><MapPin size={13} /> {interestHeadline(profile.interestRegions)} <ChevronRight size={13} /></button>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="찜한 매물" onClick={onOpenSaved}><Heart size={19} /></button>
          <button className="icon-button has-badge" aria-label="알림" onClick={onOpenNotifications}><Bell size={19} /><span /></button>
        </div>
      </header>

      <main className="home-main">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">오늘의 집콕</p>
            <h1>{greetingName(profile.name)}님에게 맞는 <span>다음 집</span>을 찾아봤어요.</h1>
          </div>
        </section>

        <section className="recommendation-banner" onClick={() => tradeListings[0] && onOpenListing(tradeListings[0])}>
          <img src="/assets/apt-city.jpg" alt="서울 아파트 전경" />
          <div className="banner-overlay" />
          <div className="banner-content">
            <div className="banner-top"><StatusPill tone="green">관심지역 추천</StatusPill><span>{firstInterest ? firstInterest.sigungu : "관심지역"} · {firstInterestTradeCount}건</span></div>
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
          <SectionHeader eyebrow="맞춤 알림" title="놓치면 아쉬운 소식" action="전체보기" onAction={onOpenListingAlerts} />
          <div className="alert-list">
            {listingAlerts.slice(0, 2).map((item) => (
              <div className="alert-row" key={item.id}><span className={`alert-dot ${item.dot}-dot`} /><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className="alert-time">{item.time}</span></div>
            ))}
          </div>
        </section>

        <section className="home-listings-section">
          <SectionHeader eyebrow="관심지역 거래" title="지금 보고 있는 매물" action="더보기" onAction={onGoListings} />
          <div className="horizontal-cards">
            {tradeListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => toast("관심 매물에 저장했어요")} compact />)}
          </div>
        </section>

        <div className="chat-fab-wrap">
          {showChatTeaser && <div className="chat-fab-teaser">궁금한 점, AI한테 물어보세요</div>}
          <button className="chat-fab" onClick={onGoChat} aria-label="AI 상담"><Bot size={19} /></button>
        </div>
      </main>
    </div>
  );
}

function SavedListingsView({ listings: savedListings, onOpenListing, onToggleLike, onBack }: { listings: Listing[]; onOpenListing: (listing: Listing) => void; onToggleLike: (listing: Listing) => void; onBack: () => void }) {
  return (
    <div className="screen-content">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button>
          <div><p className="eyebrow">내 공간</p><h1>찜한 매물</h1></div>
        </div>
      </header>
      <main className="favorites-main">
        {savedListings.length > 0 ? (
          <div className="favorite-stack">
            {savedListings.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => onOpenListing(listing)} onToggleLike={() => onToggleLike(listing)} />)}
          </div>
        ) : (
          <p className="ch-empty">아직 찜한 매물이 없어요</p>
        )}
      </main>
    </div>
  );
}

function NotificationListView({ initialTab, showTabs = true, onBack }: { initialTab: NotificationCategory; showTabs?: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<NotificationCategory>(initialTab);
  const listingAlerts = notifications.filter((item) => item.category === "listing");
  const systemAlerts = notifications.filter((item) => item.category === "system");
  const items = !showTabs ? listingAlerts : tab === "listing" ? listingAlerts : systemAlerts;
  return (
    <div className="screen-content">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button>
          <div><p className="eyebrow">{showTabs ? "내 소식" : "맞춤 알림"}</p><h1>{showTabs ? "알림" : "매물 소식"}</h1></div>
        </div>
      </header>
      <main className="chat-main">
        {showTabs && (
          <div className="segment-control">
            <button className={tab === "listing" ? "active" : ""} onClick={() => setTab("listing")}>매물 소식 <span>{listingAlerts.length}</span></button>
            <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>시스템 공지 <span>{systemAlerts.length}</span></button>
          </div>
        )}
        {items.length > 0 ? (
          <div className="alert-list">
            {items.map((item) => (
              <div className="alert-row" key={item.id}><span className={`alert-dot ${item.dot}-dot`} /><div><strong>{item.title}</strong><p>{item.detail}</p></div><span className="alert-time">{item.time}</span></div>
            ))}
          </div>
        ) : (
          <p className="ch-empty">아직 알림이 없어요</p>
        )}
      </main>
    </div>
  );
}

function ChatView({ listingFilter, onOpenRoom, onLogin, onOpenSessions }: { listingFilter: { id: number; title: string } | null; onOpenRoom: (roomId: number) => void; onLogin: () => void; onOpenSessions: () => void }) {
  const { user } = useAuth();
  const allRooms = useChatRooms();
  // 서버 대화방 → 프론트 담당 화면 타입(ChatThread)
  const chatThreads = (allRooms ?? []).filter((room) => !listingFilter || (room.listingId === listingFilter.id && room.myRole === "seller")).map((room) => toChatThread(room));
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">대화</p><h1>채팅</h1></div></header><main className="chat-main"><button className="ai-thread" onClick={onOpenSessions}><div className="thread-avatar ai-avatar"><Bot size={20} /></div><div className="thread-copy"><div><strong>AI 상담</strong><StatusPill tone="green">고정</StatusPill></div><p>내 조건에 맞는 청약과 거래를 찾아드릴게요.</p></div><span className="thread-time">지금</span><ChevronRight size={17} /></button><div className="chat-divider"><span>{listingFilter ? `${listingFilter.title} 문의` : "분양권 거래"}</span><span>{chatThreads.length}개</span></div><div className="chat-list">{allRooms && chatThreads.length === 0 && <p className="ch-empty">{!user ? <>로그인하면 거래 채팅을 볼 수 있어요 <button className="text-action" onClick={onLogin}>로그인</button></> : listingFilter ? "아직 이 매물에 온 문의가 없어요" : "아직 대화가 없어요. 매물 상세에서 판매자와 채팅을 시작해보세요"}</p>}{chatThreads.map((thread) => { const last = thread.messages[thread.messages.length - 1]; const unread = thread.unread ?? 0; return <button key={thread.id} className="chat-row" onClick={() => thread.roomId !== undefined && onOpenRoom(thread.roomId)}><div className="thread-avatar seller-avatar">{avatarText(thread.name)}</div><div className="thread-copy"><div><strong>{thread.listingTitle} · {ROLE_LABELS[thread.myRole === "seller" ? "buyer" : "seller"]}</strong>{thread.status && <StatusPill tone={CHAT_STATUS_TONES[thread.status]}>{CHAT_STATUS_LABELS[thread.status]}</StatusPill>}</div><p>{last?.text ?? "아직 메시지가 없어요"}</p></div><div className="chat-meta"><span>{last?.time ?? ""}</span>{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</div></button>; })}</div><div className="chat-tip"><CircleHelp size={17} /><div><strong>거래 채팅은 안심번호로 보호돼요</strong><p>상대방과 주고받은 서류는 계약서류 점검 이력에 저장됩니다.</p></div></div></main></div>;
}

function MyListingsView({ listings: favoriteListings, onOpenListing, onOpenRegister, onOpenInquiries }: { listings: Listing[]; onOpenListing: (listing: Listing) => void; onOpenRegister: () => void; onOpenInquiries: (listing: Listing) => void }) {
  const chatRooms = useChatRooms();
  const postedListings = favoriteListings.filter((listing) => listing.type === "trade");
  const postedListing = postedListings[0];
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">내 공간</p><h1>내 매물 관리</h1></div></header><main className="favorites-main"><div className="posted-view"><div className="posted-summary"><div><span className="eyebrow">판매 중인 매물</span><strong>{postedListings.length}건</strong><p>관심 있는 구매자와 대화를 시작해보세요.</p></div><div className="posted-chart"><span /><span /><span /><span /><span /></div></div>{postedListing && <div className="posted-card" onClick={() => onOpenListing(postedListing)}><div className="posted-card-image"><img src={postedListing.image} alt="" /><StatusPill tone="green">{postedListing.presale?.status === "review" ? "검토중" : "거래중"}</StatusPill></div><div><div className="listing-meta"><span>{postedListing.location}</span><span>조회 24</span></div><h3>{postedListing.title}</h3><strong className="listing-price">{postedListing.price}</strong><div className="posted-actions"><button onClick={(event) => { event.stopPropagation(); toast("등록 매물을 수정할 수 있어요"); }}>수정</button><button onClick={(event) => { event.stopPropagation(); toast("매물 통계를 확인했어요"); }}>통계 보기</button><button onClick={(event) => { event.stopPropagation(); onOpenInquiries(postedListing); }}>문의 {(chatRooms ?? []).filter((room) => room.listingId === postedListing.id && room.myRole === "seller").length}건</button></div></div></div>}</div><button className="add-listing-button" onClick={onOpenRegister}><Plus size={18} /><span>새 매물 등록하기</span><ChevronRight size={16} /></button></main></div>;
}

function MyView({ onOpenProfile, onLogin, onVerifyIdentity }: { onOpenProfile: () => void; onLogin: () => void; onVerifyIdentity: () => void }) {
  const { user } = useAuth();
  const profile = useProfile();
  const likedPresaleCount = useLikedPresaleCount();
  const menuItems = [
    { icon: <UserRound size={18} />, label: "프로필 · 관심지역 설정", detail: profileSummary(profile) },
    { icon: <ShieldCheck size={18} />, label: user?.identityVerified ? "본인 인증 완료" : "본인 인증하기", detail: user?.identityVerified ? "인증된 계정이에요" : "시연용 데모 인증", action: user && !user.identityVerified ? onVerifyIdentity : user ? () => toast("이미 본인 인증을 마쳤어요") : onLogin },
    { icon: <Bell size={18} />, label: "알림 구독 관리", detail: "청약 3개 · 거래 2개" },
    { icon: <FileCheck2 size={18} />, label: "계약서류 점검 이력", detail: "최근 점검 2건" },
    { icon: <WalletCards size={18} />, label: "멤버십 관리", detail: "집콕 프리미엄 이용 중" },
  ];
  return <div className="screen-content"><header className="page-header"><div><p className="eyebrow">내 정보</p><h1>MY</h1></div></header><main className="my-main"><div className="profile-card"><div className="profile-top"><div className="profile-avatar">{shortName(profile.name)}</div><div><h2>{profile.name}님</h2><p>가입일 2026. 04. 18</p></div></div><div className="profile-divider" /><div className="profile-stats"><div><span>청약 가점</span><strong>62점</strong></div><div><span>관심지역</span><strong>{profile.interestRegions.length}곳</strong></div><div><span>찜한 매물</span><strong>{likedPresaleCount}건</strong></div></div></div><div className="my-section"><SectionHeader eyebrow="관리" title="내 설정" /><div className="my-menu">{menuItems.map((item) => <button key={item.label} className="my-menu-row" onClick={item.action ?? (item.label === "프로필 · 관심지역 설정" ? onOpenProfile : () => toast(`${item.label} 화면을 준비 중이에요`))}><div className="my-menu-icon">{item.icon}</div><div><strong>{item.label}</strong><span>{item.detail}</span></div><ChevronRight size={16} /></button>)}</div></div><div className="membership-card"><div className="membership-icon"><Sparkles size={18} /></div><div><span className="eyebrow">집콕 프리미엄</span><strong>계약서류 AI 점검을 무제한으로</strong><p>다음 결제일 2026. 12. 18</p></div><button onClick={() => toast("멤버십 관리 화면을 준비 중이에요")}><ChevronRight size={16} /></button></div><div className="my-footer"><span>버전 1.0.0</span><button onClick={() => toast("이용약관 화면을 준비 중이에요")}>이용약관</button><button onClick={() => toast("개인정보처리방침 화면을 준비 중이에요")}>개인정보처리방침</button>{user ? <button onClick={() => void logout().then(() => toast("로그아웃했어요"))}>로그아웃</button> : <button onClick={onLogin}>로그인</button>}</div></main></div>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const aiSessions = useAiSessions();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showAiSessions, setShowAiSessions] = useState(false);
  /** activeThread를 어디서 열었는지. "sessions"면 뒤로가기 때 대화 목록으로 돌아간다 */
  const [threadOrigin, setThreadOrigin] = useState<"sessions" | null>(null);
  const [showSavedListings, setShowSavedListings] = useState(false);
  const [notificationsView, setNotificationsView] = useState<{ tab: NotificationCategory; showTabs: boolean } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showIdentityVerification, setShowIdentityVerification] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<number | null>(null);
  const [authPrompt, setAuthPrompt] = useState<{ reason: string; then?: () => void } | null>(null);
  const [onboardingAfterAuth, setOnboardingAfterAuth] = useState<{ name?: string; then?: () => void } | null>(null);
  const { user } = useAuth();
  const [chatFilter, setChatFilter] = useState<{ id: number; title: string } | null>(null);
  const noticeListings = listings.filter((listing) => listing.type === "notice");
  const [homeListings, setHomeListings] = useState<Listing[]>(noticeListings);
  const [postedListings, setPostedListings] = useState<Listing[]>([]);
  const [likedIds, setLikedIds] = useState<number[]>(noticeListings.filter((listing) => listing.liked).map((listing) => listing.id));
  const favoriteListings = [...postedListings, ...homeListings.filter((listing) => listing.type === "notice")];
  const savedListings = favoriteListings.filter((listing) => listing.liked);

  useEffect(() => {
    let active = true;
    const reloadListings = async () => {
      const [visiblePresaleListings, allPresaleListings, complexes] = await Promise.all([
        presaleRepository.listListings(),
        presaleRepository.listListings({ includeHidden: true }),
        presaleRepository.listComplexes(),
      ]).catch(() => [[], [], []] as [PresaleListing[], PresaleListing[], Awaited<ReturnType<typeof presaleRepository.listComplexes>>]);
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
          // 내 매물 여부는 서버가 로그인 정보로 판단한다
          (listing) => listing.presale?.isMine === true,
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
  /** 로그인이 필요한 동작: 로그인 안 했으면 로그인 화면을 띄우고, 로그인하면 이어서 실행한다 */
  const requireLogin = (reason: string, action: () => void) => {
    if (user) action();
    else setAuthPrompt({ reason, then: action });
  };
  const toggleListingLike = (listing: Listing) => {
    if (!user) {
      setAuthPrompt({ reason: "찜하려면 로그인이 필요해요" });
      return;
    }
    if (listing.type === "trade") {
      void presaleRepository.toggleLike(listing.id).then((updated) => {
        setLikedIds((current) => updated.liked
          ? [...current.filter((id) => id !== updated.id), updated.id]
          : current.filter((id) => id !== updated.id));
        toast(updated.liked ? "관심 매물에 저장했어요" : "관심 매물에서 삭제했어요");
      }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "찜하지 못했어요"));
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
  // AI 상담 버튼: 가장 최근 AI 대화를 연다(프론트 담당 동작)
  const goChat = () => { setSelectedListing(null); setThreadOrigin(null); setSelectedThreadId(aiSessions[0]?.id ?? null); };
  const openAiSessions = () => setShowAiSessions(true);
  const openAiSession = (sessionId: string) => { setShowAiSessions(false); setThreadOrigin("sessions"); setSelectedThreadId(sessionId); };
  const startNewAiSession = () => {
    const session = aiChatRepository.startSession();
    setShowAiSessions(false);
    setThreadOrigin("sessions");
    setSelectedThreadId(session.id);
  };
  const changeTab = (tab: Tab) => { setChatFilter(null); setActiveTab(tab); };
  const isMyListing = (listing: Listing) => listing.type === "trade" && (listing.presale?.isMine === true || postedListings.some((posted) => posted.id === listing.id));
  /** 같은 매물·같은 구매자면 서버가 기존 대화방을 돌려준다 */
  const ensureRoom = (listing: Listing) => chatRepository.openRoomForListing(listing.id);
  const openChatForListing = (listing: Listing) => requireLogin("채팅하려면 로그인이 필요해요", () => {
    void ensureRoom(listing)
      .then((room) => {
        setSelectedListing(null);
        setChatRoomId(room.id);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "대화방을 열지 못했어요"));
  });
  const sendOfferForListing = (listing: Listing, amount: number) => requireLogin("가격을 제안하려면 로그인이 필요해요", () => {
    void ensureRoom(listing)
      .then((room) => chatRepository.sendOffer(room.id, amount).then(() => room))
      .then((room) => {
        toast("가격 제안을 판매자에게 보냈어요");
        setSelectedListing(null);
        setChatRoomId(room.id);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "가격 제안을 보내지 못했어요"));
  });
  const openInquiries = (listing: Listing) => {
    setSelectedListing(null);
    setChatFilter({ id: listing.id, title: listing.title });
    setActiveTab("chat");
  };
  const openListingById = async (listingId: number) => {
    const presaleListing = await presaleRepository.getListing(listingId);
    const complex = presaleListing ? await presaleRepository.getComplex(presaleListing.complexId) : null;
    if (!presaleListing || !complex) {
      toast("매물 정보를 찾을 수 없어요");
      return;
    }
    setChatRoomId(null);
    setSelectedListing(toListing(presaleListing, complex));
  };
  const goListings = () => { setSelectedListing(null); setActiveTab("listings"); };
  const openRegister = () => requireLogin("매물을 등록하려면 로그인이 필요해요", () => setShowRegister(true));
  const handleRegistered = async (created: PresaleListing) => {
    const complex = await presaleRepository.getComplex(created.complexId);
    if (!complex) return;
    setShowRegister(false);
    setActiveTab("favorites");
    setSelectedListing(toListing(created, complex));
  };

  if (authPrompt) {
    return (
      <div className="app-frame">
        <AuthScreen
          reason={authPrompt.reason}
          onClose={() => setAuthPrompt(null)}
          onDone={(loggedIn, mode) => {
            const next = authPrompt.then;
            setAuthPrompt(null);
            if (mode === "signup") {
              setOnboardingAfterAuth({ name: loggedIn.realName ?? loggedIn.nickname, then: next });
              return;
            }
            toast(`${loggedIn.nickname}님, 반가워요`);
            next?.();
          }}
        />
      </div>
    );
  }

  if (onboardingAfterAuth) {
    return (
      <div className="app-frame">
        <OnboardingScreen
          initialName={onboardingAfterAuth.name}
          onComplete={(saved) => {
            const next = onboardingAfterAuth.then;
            setOnboardingAfterAuth(null);
            toast(saved ? "환영해요! 맞춤 정보를 준비했어요" : "언제든 MY에서 프로필을 완성할 수 있어요");
            next?.();
          }}
        />
      </div>
    );
  }

  if (showProfile) {
    return (
      <div className="app-frame">
        <ProfileForm
          onClose={() => setShowProfile(false)}
          onSaved={() => {
            setShowProfile(false);
            setActiveTab("my");
            toast("내 정보를 저장했어요");
          }}
        />
      </div>
    );
  }

  if (showIdentityVerification) {
    return <div className="app-frame"><IdentityVerificationScreen onClose={() => setShowIdentityVerification(false)} onDone={() => { setShowIdentityVerification(false); toast.success("본인 인증을 마쳤어요"); }} /></div>;
  }

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

  if (chatRoomId) {
    return (
      <div className="app-frame">
        <TradeChatRoom roomId={chatRoomId} onBack={() => setChatRoomId(null)} onOpenListing={(listingId) => void openListingById(listingId)} />
      </div>
    );
  }

  if (selectedListing) {
    const currentListing = { ...selectedListing, liked: likedIds.includes(selectedListing.id) };
    return <div className="app-frame"><ListingDetail listing={currentListing} liked={currentListing.liked ?? false} isMine={isMyListing(currentListing)} onBack={() => setSelectedListing(null)} onToggleLike={toggleLike} onGoChat={() => openChatForListing(currentListing)} onSendOffer={(amount) => sendOfferForListing(currentListing, amount)} onOpenInquiries={() => openInquiries(currentListing)} /></div>;
  }

  const activeThread = selectedThreadId ? aiSessions.find((thread) => thread.id === selectedThreadId) ?? null : null;
  if (activeThread) {
    return (
      <div className="app-frame">
        <ChatRoomView
          thread={activeThread}
          onBack={() => {
            setSelectedThreadId(null);
            if (threadOrigin === "sessions") {
              setThreadOrigin(null);
              setShowAiSessions(true);
            }
          }}
          onSend={(text) => aiChatRepository.sendMessage(activeThread.id, text)}
        />
      </div>
    );
  }

  if (showSavedListings) {
    return (
      <div className="app-frame">
        <SavedListingsView
          listings={savedListings}
          onOpenListing={openListing}
          onToggleLike={toggleListingLike}
          onBack={() => setShowSavedListings(false)}
        />
      </div>
    );
  }

  if (notificationsView) {
    return (
      <div className="app-frame">
        <NotificationListView initialTab={notificationsView.tab} showTabs={notificationsView.showTabs} onBack={() => setNotificationsView(null)} />
      </div>
    );
  }

  if (showAiSessions) {
    return (
      <div className="app-frame">
        <ChatSessionList
          sessions={aiSessions}
          onOpenSession={(session) => openAiSession(session.id)}
          onNewSession={startNewAiSession}
          onBack={() => setShowAiSessions(false)}
        />
      </div>
    );
  }

  const content = activeTab === "home" ? <HomeView listings={homeListings} onOpenListing={openListing} onGoListings={goListings} onGoChat={goChat} onOpenSaved={() => setShowSavedListings(true)} onOpenNotifications={() => setNotificationsView({ tab: "listing", showTabs: true })} onOpenListingAlerts={() => setNotificationsView({ tab: "listing", showTabs: false })} onEditRegions={() => setShowProfile(true)} /> : activeTab === "listings" ? <ListingsView onOpenListing={openListing} /> : activeTab === "chat" ? <ChatView listingFilter={chatFilter} onOpenRoom={setChatRoomId} onOpenSessions={openAiSessions} onLogin={() => setAuthPrompt({ reason: "채팅하려면 로그인이 필요해요" })} /> : activeTab === "favorites" ? <MyListingsView listings={favoriteListings} onOpenListing={openListing} onOpenRegister={openRegister} onOpenInquiries={openInquiries} /> : <MyView onOpenProfile={() => setShowProfile(true)} onLogin={() => setAuthPrompt({ reason: "로그인하고 집콕을 이용해보세요" })} onVerifyIdentity={() => setShowIdentityVerification(true)} />;
  return <div className="app-frame">{content}<BottomNav active={activeTab} onChange={changeTab} /></div>;
}
