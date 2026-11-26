import { ArrowLeft, Bot, ChevronRight, Plus } from "lucide-react";
import type { ChatThread } from "@/features/chat/types";

export function ChatSessionList({
  sessions,
  onOpenSession,
  onNewSession,
  onBack,
}: {
  sessions: ChatThread[];
  onOpenSession: (session: ChatThread) => void;
  onNewSession: () => void;
  onBack: () => void;
}) {
  return (
    <div className="screen-content">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="icon-button" onClick={onBack}><ArrowLeft size={20} /></button>
          <div><p className="eyebrow">AI 상담</p><h1>대화 목록</h1></div>
        </div>
      </header>
      <main className="chat-main">
        <button className="add-listing-button" onClick={onNewSession}>
          <Plus size={18} /><span>새 대화 시작</span>
        </button>
        <div className="chat-list">
          {sessions.map((session) => {
            const lastMessage = session.messages[session.messages.length - 1];
            return (
              <button key={session.id} className="chat-row" onClick={() => onOpenSession(session)}>
                <div className="thread-avatar ai-avatar"><Bot size={18} /></div>
                <div className="thread-copy">
                  <div><strong>{session.name}</strong></div>
                  <p>{lastMessage?.text}</p>
                </div>
                <div className="chat-meta">
                  <span>{session.subtitle}</span>
                </div>
                <ChevronRight size={16} />
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
