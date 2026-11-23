import { useLayoutEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Bot, CircleHelp, Send } from "lucide-react";
import type { ChatThread } from "@/features/chat/types";
import { StatusPill } from "@/components/common/StatusPill";
import { findExternalContact } from "@/features/presale/ai/demoRules";
import { formatWon } from "@/features/presale/lib/format";
import { CHAT_STATUS_LABELS, CHAT_STATUS_TONES, OFFER_STATUS_LABELS, type OfferStatus } from "@/features/chat/tradeTypes";
import { useKeyboardInset } from "@/features/chat/lib/useChat";
import "@/features/chat/chat.css";

const OFFER_TONES: Record<OfferStatus, "green" | "sand" | "neutral"> = {
  pending: "sand",
  accepted: "green",
  rejected: "neutral",
  superseded: "neutral",
};

/** 화면 스크롤 주체: 데스크톱은 앱 틀 안 .chatroom-screen, 모바일은 창 */
function scrollToBottom(): void {
  const screen = document.querySelector<HTMLElement>(".app-frame > .chatroom-screen");
  if (screen && getComputedStyle(screen).overflowY === "auto" && screen.scrollHeight > screen.clientHeight) screen.scrollTop = screen.scrollHeight;
  else window.scrollTo(0, document.documentElement.scrollHeight);
}

export function ChatRoomView({
  thread,
  onBack,
  onSend,
  onRespondOffer,
  onComplete,
  onOpenListing,
}: {
  thread: ChatThread;
  onBack: () => void;
  onSend: (text: string) => void;
  /** 거래 채팅: 가격 제안 수락·거절(판매자만) */
  onRespondOffer?: (messageId: number, accept: boolean) => void;
  /** 거래 채팅: 거래 완료 표시(판매자만, 계약진행일 때) */
  onComplete?: () => void;
  /** 상단 매물 카드를 누르면 매물 상세로 */
  onOpenListing?: () => void;
}) {
  const [draft, setDraft] = useState("");
  /** 외부 연락 유도 문구(전화번호·카톡 ID 등)가 있으면 보내기 전에 경고 */
  const [warning, setWarning] = useState<string | null>(null);
  const keyboardInset = useKeyboardInset();
  const closed = thread.status === "done";

  useLayoutEffect(() => {
    scrollToBottom();
  }, [thread.messages.length]);

  const send = (force = false) => {
    const text = draft.trim();
    if (!text || closed) return;
    const contact = thread.kind === "seller" ? findExternalContact(text) : null;
    if (contact && !force) {
      setWarning(contact);
      return;
    }
    onSend(text);
    setDraft("");
    setWarning(null);
  };

  return (
    <div className="chatroom-screen">
      <header className="chatroom-header">
        <button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button>
        <div className={`thread-avatar ${thread.kind === "ai" ? "ai-avatar" : "seller-avatar"}`}>
          {thread.kind === "ai" ? <Bot size={18} /> : thread.name.slice(0, 2)}
        </div>
        <div className="chatroom-title">
          <strong>{thread.name}</strong>
          <span>{thread.subtitle}</span>
        </div>
      </header>

      {thread.listingTitle && (
        <div className={`chatroom-pinned ${onOpenListing ? "ch-pinned-link" : ""}`} onClick={onOpenListing} role={onOpenListing ? "button" : undefined}>
          <img src={thread.listingImage} alt="" />
          <div>
            <span>{thread.listingTitle}</span>
            <strong>{thread.listingPrice}</strong>
          </div>
        </div>
      )}

      {/* 거래 상태는 머리말 부제에 보인다. 판매자가 거래를 완료할 수 있을 때만 상태와 버튼 줄을 보여준다 */}
      {thread.status === "contracting" && thread.myRole === "seller" && onComplete && (
        <div className="ch-status-row ch-room-status">
          <StatusPill tone={CHAT_STATUS_TONES[thread.status]}>{CHAT_STATUS_LABELS[thread.status]}</StatusPill>
          <button className="text-action" onClick={onComplete}>거래 완료로 표시</button>
        </div>
      )}

      <main className="chatroom-messages">
        {thread.messages.map((message) => {
          if (message.kind === "system") return <p key={message.id} className="ch-system">{message.text}</p>;
          if (message.kind === "offer" && message.offer) {
            const { offer } = message;
            const diff = offer.amount - offer.baseAmount;
            const canRespond = message.sender === "other" && offer.status === "pending" && thread.myRole === "seller" && onRespondOffer;
            return (
              <div key={message.id} className={`bubble-row ${message.sender}`}>
                <div className="ch-offer">
                  <div className="ch-offer-head">
                    <span className="eyebrow">{message.sender === "me" ? "내가 보낸 가격 제안" : "가격 제안"}</span>
                    <StatusPill tone={OFFER_TONES[offer.status]}>{OFFER_STATUS_LABELS[offer.status]}</StatusPill>
                  </div>
                  <strong>{formatWon(offer.amount)}</strong>
                  <p>총 필요자금 {formatWon(offer.baseAmount)}보다 {formatWon(Math.abs(diff))} {diff <= 0 ? "낮아요" : "높아요"}</p>
                  {canRespond && (
                    <div className="ch-offer-actions">
                      <button className="action-secondary" onClick={() => onRespondOffer(offer.messageId, false)}>거절</button>
                      <button className="action-primary" onClick={() => onRespondOffer(offer.messageId, true)}>수락</button>
                    </div>
                  )}
                </div>
                <span className="bubble-time">{message.time}</span>
              </div>
            );
          }
          return (
            <div key={message.id} className={`bubble-row ${message.sender}`}>
              <div className="bubble">{message.text}</div>
              <span className="bubble-time">{message.time}</span>
            </div>
          );
        })}
        {thread.kind === "seller" && (
          <div className="chat-tip">
            <CircleHelp size={17} />
            <div>
              <strong>거래 채팅은 안심번호로 보호돼요</strong>
              <p>상대방과 주고받은 서류는 계약서류 점검 이력에 저장됩니다.</p>
            </div>
          </div>
        )}
      </main>

      <div className="chatroom-input-bar" style={keyboardInset ? { bottom: keyboardInset } : undefined}>
        {warning && (
          <div className="ch-warning ch-warning-floating" role="alert">
            <AlertTriangle size={17} />
            <div>
              <strong>집콕 채팅 밖 거래는 보호받기 어려워요</strong>
              <p>"{warning}"처럼 연락처·외부 메신저를 안내하는 내용이 있어요.</p>
              <div className="ch-warning-actions">
                <button className="text-action" onClick={() => setWarning(null)}>고칠게요</button>
                <button className="text-action" onClick={() => send(true)}>그래도 보내기</button>
              </div>
            </div>
          </div>
        )}
        <input
          className="chatroom-input"
          placeholder={closed ? "거래가 끝난 대화방이에요" : "메시지 보내기"}
          value={draft}
          disabled={closed}
          onChange={(event) => {
            setDraft(event.target.value);
            if (warning) setWarning(null);
          }}
          onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && send()}
        />
        <button className="chatroom-send" onClick={() => send()} disabled={closed}><Send size={17} /></button>
      </div>
    </div>
  );
}
