import { chatThreads } from "../data/threads";
import type { ChatThread } from "../types";

/**
 * AI 상담 대화 저장소 인터페이스. 지금은 프론트 담당의 더미 대화(data/threads.ts)로 동작한다.
 * AI를 붙일 때는 이 인터페이스의 구현체만 바꾼다(sendMessage에서 AI 답을 받아 붙이면 된다).
 */
export interface AiChatRepository {
  /** 최근 활동 순 */
  listSessions(): ChatThread[];
  startSession(): ChatThread;
  sendMessage(threadId: string, text: string): void;
  subscribe(listener: () => void): () => void;
}

export function createDummyAiChatRepository(): AiChatRepository {
  let sessions: ChatThread[] = chatThreads.filter((thread) => thread.kind === "ai");
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    listSessions: () => sessions,
    startSession() {
      const session: ChatThread = {
        id: `ai-${Date.now()}`,
        kind: "ai",
        name: "새로운 질문",
        subtitle: "방금 전",
        messages: [{ id: "1", sender: "other", text: "안녕하세요! 무엇을 도와드릴까요?", time: "방금 전" }],
      };
      sessions = [session, ...sessions];
      emit();
      return session;
    },
    sendMessage(threadId, text) {
      sessions = sessions.map((thread) =>
        thread.id === threadId
          ? { ...thread, messages: [...thread.messages, { id: `local-${thread.messages.length}`, sender: "me", text, time: "방금 전" }] }
          : thread,
      );
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const aiChatRepository: AiChatRepository = createDummyAiChatRepository();

