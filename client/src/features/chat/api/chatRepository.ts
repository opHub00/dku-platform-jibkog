import { formatWon } from "@/features/presale/lib/format";
import {
  CHAT_STATUS_LABELS,
  type ChatChangeEvent,
  type ChatMessage,
  type ChatParticipant,
  type ChatRole,
  type ChatRoom,
  type ChatRoomStatus,
} from "../types";

/**
 * 분양권 거래 채팅 저장소 인터페이스. 백엔드가 정해지면 구현체만 바꾼다(README.md 참고).
 * 보낸 사람은 대화방 안의 역할(buyer/seller)로 받는다. 로그인이 붙으면 구현체가 인증 사용자로 역할을 확인한다.
 */
export interface ChatRepository {
  listRooms(): Promise<ChatRoom[]>;
  getRoom(roomId: string): Promise<ChatRoom | null>;
  /** 같은 매물·같은 구매자·같은 판매자 방이 있으면 그 방을 돌려준다 */
  findOrCreateRoom(input: { listingId: number; listingTitle: string; buyer: ChatParticipant; seller: ChatParticipant }): Promise<ChatRoom>;
  listMessages(roomId: string): Promise<ChatMessage[]>;
  sendText(roomId: string, senderRole: ChatRole, text: string): Promise<ChatMessage>;
  /** 가격 제안 카드. 답변 대기 중인 이전 제안은 "새 제안으로 바뀜"이 된다 */
  sendOffer(roomId: string, senderRole: ChatRole, amount: number, baseAmount: number): Promise<ChatMessage>;
  /** 상대 역할만 답할 수 있다. 수락하면 거래 상태가 계약진행이 된다 */
  respondOffer(roomId: string, messageId: string, responderRole: ChatRole, accept: boolean): Promise<void>;
  updateStatus(roomId: string, status: ChatRoomStatus, byRole: ChatRole): Promise<void>;
  markRead(roomId: string, role: ChatRole): Promise<void>;
  /** 이 탭과 같은 브라우저의 다른 탭에서 바뀐 내용을 알린다 */
  subscribe(listener: (event: ChatChangeEvent) => void): () => void;
}

export class ChatRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatRepositoryError";
  }
}

type ChatState = { rooms: ChatRoom[]; messages: ChatMessage[] };

const STORAGE_KEY = "zipcok.chat.v1";
const CHANNEL_NAME = "zipcok-chat";
const MAX_TEXT_LENGTH = 500;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function otherRole(role: ChatRole): ChatRole {
  return role === "buyer" ? "seller" : "buyer";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatState(value: unknown): value is ChatState {
  return isRecord(value) && Array.isArray(value.rooms) && Array.isArray(value.messages);
}

/** 목록에 보여줄 한 줄 */
export function messagePreview(message: ChatMessage): string {
  if (message.kind === "offer") return `가격 제안 ${formatWon(message.amount)}`;
  return message.text.length > 60 ? `${message.text.slice(0, 60)}…` : message.text;
}

export function createLocalStorageChatRepository(storageKey: string = STORAGE_KEY): ChatRepository {
  const listeners = new Set<(event: ChatChangeEvent) => void>();
  let channel: BroadcastChannel | null = null;
  let storageListening = false;
  let memory: ChatState = { rooms: [], messages: [] };

  /** 보내기와 받기에 같은 채널을 쓴다. 처음 쓸 때 열고 페이지가 닫힐 때까지 유지한다(구독자가 없는 탭도 알림을 보내야 한다). */
  function getChannel(): BroadcastChannel | null {
    if (channel || typeof BroadcastChannel === "undefined") return channel;
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", onChannelMessage);
    return channel;
  }

  function storage(): Storage | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  /** 다른 탭이 쓴 내용을 놓치지 않게 쓸 때마다 저장소에서 새로 읽는다. */
  function load(): ChatState {
    const s = storage();
    if (s) {
      try {
        const raw = s.getItem(storageKey);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isChatState(parsed)) {
            memory = parsed;
            return structuredClone(parsed);
          }
        }
      } catch {
        // 깨진 값이면 메모리 값을 쓴다
      }
    }
    return structuredClone(memory);
  }

  function emit(event: ChatChangeEvent): void {
    listeners.forEach((listener) => listener(event));
  }

  function save(state: ChatState, roomId: string | null): void {
    memory = state;
    const s = storage();
    if (s) {
      try {
        s.setItem(storageKey, JSON.stringify(state));
      } catch {
        // 용량 초과여도 이 탭에서는 계속 동작한다
      }
    }
    const event: ChatChangeEvent = { type: "changed", roomId };
    getChannel()?.postMessage(event);
    emit(event);
  }

  function requireRoom(state: ChatState, roomId: string): ChatRoom {
    const room = state.rooms.find((r) => r.id === roomId);
    if (!room) throw new ChatRepositoryError("대화방을 찾을 수 없어요");
    return room;
  }

  function appendMessage(state: ChatState, room: ChatRoom, message: ChatMessage): void {
    state.messages.push(message);
    room.updatedAt = message.createdAt;
    room.lastMessage = { preview: messagePreview(message), at: message.createdAt, senderRole: message.senderRole };
    if (message.senderRole !== "system") room.unread[otherRole(message.senderRole)] += 1;
  }

  function systemMessage(roomId: string, text: string): ChatMessage {
    return { id: newId(), roomId, kind: "system", senderRole: "system", text, createdAt: new Date().toISOString() };
  }

  function onChannelMessage(event: MessageEvent<unknown>): void {
    const data = event.data;
    if (isRecord(data) && data.type === "changed") {
      emit({ type: "changed", roomId: typeof data.roomId === "string" ? data.roomId : null });
    }
  }

  /**
   * 다른 탭이 쓴 localStorage 값은 이 탭에 비동기로 반영된다. BroadcastChannel 알림이 값보다 먼저 오면
   * 이전 값을 읽을 수 있으므로, 값이 반영된 뒤 발생하는 storage 이벤트에서도 항상 다시 읽게 한다.
   */
  function onStorage(event: StorageEvent): void {
    if (event.key === storageKey) emit({ type: "changed", roomId: null });
  }

  return {
    async listRooms() {
      return load().rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async getRoom(roomId) {
      return load().rooms.find((r) => r.id === roomId) ?? null;
    },

    async findOrCreateRoom(input) {
      const state = load();
      const existing = state.rooms.find(
        (r) => r.listingId === input.listingId && r.buyer.id === input.buyer.id && r.seller.id === input.seller.id,
      );
      if (existing) {
        // 이름이 바뀌었으면(내 정보 수정) 최신 이름으로 맞춘다
        if (existing.buyer.name !== input.buyer.name || existing.seller.name !== input.seller.name) {
          existing.buyer = input.buyer;
          existing.seller = input.seller;
          save(state, existing.id);
        }
        return existing;
      }
      const now = new Date().toISOString();
      const room: ChatRoom = {
        id: newId(),
        listingId: input.listingId,
        listingTitle: input.listingTitle,
        buyer: input.buyer,
        seller: input.seller,
        status: "inquiry",
        createdAt: now,
        updatedAt: now,
        lastMessage: null,
        unread: { buyer: 0, seller: 0 },
      };
      state.rooms.push(room);
      save(state, room.id);
      return room;
    },

    async listMessages(roomId) {
      return load()
        .messages.filter((m) => m.roomId === roomId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async sendText(roomId, senderRole, text) {
      const trimmed = text.trim();
      if (trimmed === "") throw new ChatRepositoryError("메시지를 입력해주세요");
      if (trimmed.length > MAX_TEXT_LENGTH) throw new ChatRepositoryError(`${MAX_TEXT_LENGTH}자까지 보낼 수 있어요`);
      const state = load();
      const room = requireRoom(state, roomId);
      if (room.status === "done") throw new ChatRepositoryError("거래가 끝난 대화방이에요");
      const message: ChatMessage = { id: newId(), roomId, kind: "text", senderRole, text: trimmed, createdAt: new Date().toISOString() };
      appendMessage(state, room, message);
      save(state, roomId);
      return message;
    },

    async sendOffer(roomId, senderRole, amount, baseAmount) {
      if (!Number.isInteger(amount) || amount <= 0) throw new ChatRepositoryError("제안 금액이 올바르지 않아요");
      const state = load();
      const room = requireRoom(state, roomId);
      if (room.status === "contracting" || room.status === "done") {
        throw new ChatRepositoryError("이미 계약을 진행 중인 대화방이에요");
      }
      for (const m of state.messages) {
        if (m.roomId === roomId && m.kind === "offer" && m.status === "pending") m.status = "superseded";
      }
      const message: ChatMessage = {
        id: newId(),
        roomId,
        kind: "offer",
        senderRole,
        amount,
        baseAmount,
        status: "pending",
        respondedAt: null,
        createdAt: new Date().toISOString(),
      };
      appendMessage(state, room, message);
      room.status = "negotiating";
      save(state, roomId);
      return message;
    },

    async respondOffer(roomId, messageId, responderRole, accept) {
      const state = load();
      const room = requireRoom(state, roomId);
      const offer = state.messages.find((m) => m.id === messageId && m.roomId === roomId);
      if (!offer || offer.kind !== "offer") throw new ChatRepositoryError("가격 제안을 찾을 수 없어요");
      if (offer.senderRole === responderRole) throw new ChatRepositoryError("내가 보낸 제안에는 답할 수 없어요");
      if (offer.status !== "pending") throw new ChatRepositoryError("이미 답한 제안이에요");
      offer.status = accept ? "accepted" : "rejected";
      offer.respondedAt = new Date().toISOString();
      const who = responderRole === "seller" ? "판매자" : "구매자";
      appendMessage(
        state,
        room,
        systemMessage(
          roomId,
          accept
            ? `${who}가 ${formatWon(offer.amount)} 제안을 수락했어요. 계약을 진행해요`
            : `${who}가 ${formatWon(offer.amount)} 제안을 거절했어요`,
        ),
      );
      if (accept) room.status = "contracting";
      save(state, roomId);
    },

    async updateStatus(roomId, status, byRole) {
      const state = load();
      const room = requireRoom(state, roomId);
      if (room.status === status) return;
      room.status = status;
      const who = byRole === "seller" ? "판매자" : "구매자";
      appendMessage(state, room, systemMessage(roomId, `${who}가 거래 상태를 '${CHAT_STATUS_LABELS[status]}'(으)로 바꿨어요`));
      save(state, roomId);
    },

    async markRead(roomId, role) {
      const state = load();
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room || room.unread[role] === 0) return;
      room.unread[role] = 0;
      save(state, roomId);
    },

    subscribe(listener) {
      listeners.add(listener);
      getChannel();
      if (!storageListening && typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
        storageListening = true;
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const chatRepository: ChatRepository = createLocalStorageChatRepository();
