import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Building2, ChevronRight, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/common/StatusPill";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { findExternalContact } from "@/features/presale/ai/demoRules";
import { calcTotalRequiredFunds } from "@/features/presale/lib/funds";
import { formatWon } from "@/features/presale/lib/format";
import { chatRepository } from "../api/chatRepository";
import { formatBubbleTime } from "../lib/format";
import { ROLE_LABELS } from "../lib/names";
import { useChatRoom, useKeyboardInset } from "../lib/useChat";
import {
  CHAT_STATUS_LABELS,
  CHAT_STATUS_TONES,
  OFFER_STATUS_LABELS,
  type ChatMessage,
  type ChatRole,
  type OfferStatus,
} from "../types";
import "../chat.css";

type ListingSummary = { total: number; trustScore: number | null };

const OFFER_TONES: Record<OfferStatus, "green" | "sand" | "navy" | "neutral"> = {
  pending: "sand",
  accepted: "green",
  rejected: "neutral",
  superseded: "neutral",
};

function trustTone(score: number): "green" | "navy" | "sand" | "neutral" {
  if (score >= 85) return "green";
  if (score >= 70) return "navy";
  if (score >= 50) return "sand";
  return "neutral";
}

/** 화면 스크롤 주체: 데스크톱은 앱 틀 안 .detail-screen, 모바일은 창 */
function scrollToBottom(): void {
  const screen = document.querySelector<HTMLElement>(".app-frame > .detail-screen");
  if (screen && getComputedStyle(screen).overflowY === "auto" && screen.scrollHeight > screen.clientHeight) {
    screen.scrollTop = screen.scrollHeight;
  } else {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }
}

function MessageItem({
  message,
  role,
  onRespond,
}: {
  message: ChatMessage;
  role: ChatRole;
  onRespond: (messageId: number, accept: boolean) => void;
}) {
  if (message.kind === "system") return <p className="ch-system">{message.text}</p>;
  const mine = message.senderRole === role;
  if (message.kind === "text") {
    return (
      <div className={`ch-row ${mine ? "ch-mine" : ""}`}>
        <div className="ch-bubble">{message.text}</div>
        <time className="ch-time">{formatBubbleTime(message.createdAt)}</time>
      </div>
    );
  }
  const diff = message.amount - message.baseAmount;
  const canRespond = !mine && message.status === "pending";
  return (
    <div className={`ch-row ${mine ? "ch-mine" : ""}`}>
      <div className="ch-offer">
        <div className="ch-offer-head">
          <span className="eyebrow">{mine ? "내가 보낸 가격 제안" : "가격 제안"}</span>
          <StatusPill tone={OFFER_TONES[message.status]}>{OFFER_STATUS_LABELS[message.status]}</StatusPill>
        </div>
        <strong>{formatWon(message.amount)}</strong>
        <p>
          총 필요자금 {formatWon(message.baseAmount)}보다 {formatWon(Math.abs(diff))} {diff <= 0 ? "낮아요" : "높아요"}
        </p>
        {canRespond && (
          <div className="ch-offer-actions">
            <button className="action-secondary" onClick={() => onRespond(message.id, false)}>
              거절
            </button>
            <button className="action-primary" onClick={() => onRespond(message.id, true)}>
              수락
            </button>
          </div>
        )}
      </div>
      <time className="ch-time">{formatBubbleTime(message.createdAt)}</time>
    </div>
  );
}

export function ChatRoomScreen({
  roomId,
  onClose,
  onOpenListing,
}: {
  roomId: number;
  onClose: () => void;
  onOpenListing: (listingId: number) => void;
}) {
  const { room, messages, loaded } = useChatRoom(roomId);
  const [summary, setSummary] = useState<ListingSummary | null>(null);
  const [draft, setDraft] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(66);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardInset = useKeyboardInset();
  /** 서버가 로그인 정보로 정한 내 역할 */
  const role: ChatRole = room?.myRole ?? "buyer";

  useEffect(() => {
    if (!room) return;
    let active = true;
    void presaleRepository.getListing(room.listingId).then((listing) => {
      if (active && listing) setSummary({ total: calcTotalRequiredFunds(listing), trustScore: listing.trust?.score ?? null });
    });
    return () => {
      active = false;
    };
  }, [room?.listingId]);

  // 보고 있는 동안 받은 메시지는 읽음 처리
  useEffect(() => {
    if (room && room.unread > 0 && document.visibilityState === "visible") void chatRepository.markRead(room.id);
  }, [room]);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages.length, composerHeight]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setComposerHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [loaded]);

  if (!loaded) return <div className="detail-screen" />;
  if (!room) {
    return (
      <div className="detail-screen">
        <header className="page-header">
          <div>
            <p className="eyebrow">분양권 거래</p>
            <h1>대화방이 없어요</h1>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="대화 닫기">
            <X size={19} />
          </button>
        </header>
      </div>
    );
  }

  const otherLabel = ROLE_LABELS[role === "buyer" ? "seller" : "buyer"];
  const closed = room.status === "done";

  async function send(force: boolean) {
    if (!room) return;
    const text = draft.trim();
    if (text === "") return;
    const contact = findExternalContact(text);
    if (contact && !force) {
      setWarning(contact);
      return;
    }
    try {
      await chatRepository.sendText(room.id, text);
      setDraft("");
      setWarning(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "보내지 못했어요");
    }
  }

  async function respond(messageId: number, accept: boolean) {
    if (!room) return;
    try {
      await chatRepository.respondOffer(room.id, messageId, accept);
      toast(accept ? "가격 제안을 수락했어요" : "가격 제안을 거절했어요");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "답하지 못했어요");
    }
  }

  return (
    <div className="detail-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">분양권 거래 · {otherLabel}</p>
          <h1>{room.counterpart.nickname}</h1>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="대화 닫기">
          <X size={19} />
        </button>
      </header>

      <main className="detail-body ch-body" style={{ paddingBottom: composerHeight + keyboardInset + 20 }}>
        <button className="document-card ch-listing-card" onClick={() => onOpenListing(room.listingId)}>
          <div className="document-icon">
            <Building2 size={18} />
          </div>
          <div>
            <strong>{room.listingTitle}</strong>
            <p>총 필요자금 {summary ? formatWon(summary.total) : "확인 중"}</p>
          </div>
          <div className="ch-card-side">
            {summary?.trustScore !== null && summary?.trustScore !== undefined && (
              <StatusPill tone={trustTone(summary.trustScore)}>AI 신뢰 {summary.trustScore}점</StatusPill>
            )}
            <ChevronRight size={16} />
          </div>
        </button>

        <div className="ch-status-row">
          <StatusPill tone={CHAT_STATUS_TONES[room.status]}>{CHAT_STATUS_LABELS[room.status]}</StatusPill>
          {room.status === "contracting" && role === "seller" && (
            <button className="text-action" onClick={() => void chatRepository.complete(room.id).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "바꾸지 못했어요"))}>
              거래 완료로 표시
            </button>
          )}
        </div>

        <div className="ch-messages">
          {messages.length === 0 && <p className="ch-system">첫 메시지를 보내 거래를 시작해보세요</p>}
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} role={role} onRespond={(id, accept) => void respond(id, accept)} />
          ))}
        </div>
      </main>

      <div className="ch-composer" ref={composerRef} style={{ bottom: keyboardInset }}>
        {warning && (
          <div className="ch-warning" role="alert">
            <AlertTriangle size={17} />
            <div>
              <strong>집콕 채팅 밖 거래는 보호받기 어려워요</strong>
              <p>"{warning}"처럼 연락처·외부 메신저를 안내하는 내용이 있어요.</p>
              <div className="ch-warning-actions">
                <button className="text-action" onClick={() => { setWarning(null); inputRef.current?.focus(); }}>
                  고칠게요
                </button>
                <button className="text-action" onClick={() => void send(true)}>
                  그래도 보내기
                </button>
              </div>
            </div>
          </div>
        )}
        {closed ? (
          <p className="ch-closed">거래가 끝난 대화방이에요</p>
        ) : (
          <div className="ch-input-row">
            <input
              ref={inputRef}
              className="ch-input"
              value={draft}
              maxLength={500}
              placeholder="메시지를 입력하세요"
              aria-label="메시지"
              onChange={(event) => {
                setDraft(event.target.value);
                if (warning) setWarning(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(false);
                }
              }}
            />
            <button className="ch-send" onClick={() => void send(false)} disabled={draft.trim() === ""} aria-label="보내기">
              <SendHorizontal size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
