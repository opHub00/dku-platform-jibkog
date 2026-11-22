import { useState } from "react";
import { ArrowLeft, Bot, CircleHelp, Send } from "lucide-react";
import type { ChatThread } from "@/features/chat/types";

export function ChatRoomView({ thread, onBack }: { thread: ChatThread; onBack: () => void }) {
  const [messages, setMessages] = useState(thread.messages);
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: `local-${prev.length}`, sender: "me", text, time: "지금" }]);
    setDraft("");
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
        <div className="chatroom-pinned">
          <img src={thread.listingImage} alt="" />
          <div>
            <span>{thread.listingTitle}</span>
            <strong>{thread.listingPrice}</strong>
          </div>
        </div>
      )}

      <main className="chatroom-messages">
        {messages.map((message) => (
          <div key={message.id} className={`bubble-row ${message.sender}`}>
            <div className="bubble">{message.text}</div>
            <span className="bubble-time">{message.time}</span>
          </div>
        ))}
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

      <div className="chatroom-input-bar">
        <input
          className="chatroom-input"
          placeholder="메시지 보내기"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && send()}
        />
        <button className="chatroom-send" onClick={send}><Send size={17} /></button>
      </div>
    </div>
  );
}
