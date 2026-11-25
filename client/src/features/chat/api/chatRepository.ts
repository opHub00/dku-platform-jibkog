import { apiRequest, field } from "@/features/auth/api/httpClient";
import { onServerEvent } from "@/features/auth/lib/serverEvents";
import type { ChatChangeEvent, ChatRole, ChatRoomStatus, OfferStatus, TradeChatMessage as ChatMessage, TradeChatRoom as ChatRoom } from "../tradeTypes";

/**
 * 분양권 거래 채팅 저장소 인터페이스. 화면은 이것만 쓴다.
 * 구매자/판매자 역할과 권한은 서버가 로그인 정보로 판단한다(docs/api.md).
 */
export interface ChatRepository {
  listRooms(): Promise<ChatRoom[]>;
  getRoom(roomId: number): Promise<ChatRoom | null>;
  /** 매물로 방 열기. 같은 매물·같은 구매자면 기존 방. 내 매물이면 거부(오류) */
  openRoomForListing(listingId: number): Promise<ChatRoom>;
  listMessages(roomId: number): Promise<ChatMessage[]>;
  sendText(roomId: number, text: string): Promise<void>;
  /** 가격 제안(구매자만) */
  sendOffer(roomId: number, amount: number): Promise<void>;
  /** 가격 제안 수락·거절(판매자만) */
  respondOffer(roomId: number, messageId: number, accept: boolean): Promise<void>;
  /** 거래 완료(판매자만, 계약진행일 때) */
  complete(roomId: number): Promise<void>;
  markRead(roomId: number): Promise<void>;
  /** 이 기기·다른 기기에서 바뀐 내용을 알린다(SSE) */
  subscribe(listener: (event: ChatChangeEvent) => void): () => void;
}

const ROLES: readonly ChatRole[] = ["buyer", "seller"];
const STATUSES: readonly ChatRoomStatus[] = ["inquiry", "negotiating", "contracting", "done"];
const OFFER_STATUSES: readonly OfferStatus[] = ["pending", "accepted", "rejected", "superseded"];

const isRole = (value: unknown): value is ChatRole => typeof value === "string" && (ROLES as readonly string[]).includes(value);
const num = (value: unknown, key: string): number => {
  const v = field(value, key);
  if (typeof v !== "number") throw new Error(`${key} 형식 오류`);
  return v;
};
const str = (value: unknown, key: string): string => {
  const v = field(value, key);
  if (typeof v !== "string") throw new Error(`${key} 형식 오류`);
  return v;
};

function parseRoom(value: unknown): ChatRoom {
  const myRole = field(value, "myRole");
  const status = field(value, "status");
  const counterpart = field(value, "counterpart");
  const last = field(value, "lastMessage");
  if (!isRole(myRole) || typeof status !== "string" || !(STATUSES as readonly string[]).includes(status)) throw new Error("대화방 형식 오류");
  const senderRole = field(last, "senderRole");
  return {
    id: num(value, "id"),
    listingId: num(value, "listingId"),
    listingTitle: str(value, "listingTitle"),
    myRole,
    counterpart: { id: num(counterpart, "id"), nickname: str(counterpart, "nickname") },
    status: status as ChatRoomStatus,
    createdAt: str(value, "createdAt"),
    updatedAt: str(value, "updatedAt"),
    lastMessage:
      last === null || last === undefined
        ? null
        : { preview: str(last, "preview"), at: str(last, "at"), senderRole: isRole(senderRole) ? senderRole : "system" },
    unread: num(value, "unread"),
  };
}

function parseMessage(value: unknown): ChatMessage {
  const kind = field(value, "kind");
  const base = { id: num(value, "id"), roomId: num(value, "roomId"), createdAt: str(value, "createdAt") };
  const senderRole = field(value, "senderRole");
  if (kind === "offer" && isRole(senderRole)) {
    const status = field(value, "status");
    if (typeof status !== "string" || !(OFFER_STATUSES as readonly string[]).includes(status)) throw new Error("제안 상태 형식 오류");
    const respondedAt = field(value, "respondedAt");
    return {
      ...base, kind: "offer", senderRole,
      amount: num(value, "amount"), baseAmount: num(value, "baseAmount"),
      status: status as OfferStatus, respondedAt: typeof respondedAt === "string" ? respondedAt : null,
    };
  }
  if (kind === "text" && isRole(senderRole)) return { ...base, kind: "text", senderRole, text: str(value, "text") };
  return { ...base, kind: "system", senderRole: "system", text: str(value, "text") };
}

function list<T>(value: unknown, key: string, parse: (item: unknown) => T): T[] {
  const items = field(value, key);
  if (!Array.isArray(items)) throw new Error(`${key} 형식 오류`);
  return items.map(parse);
}

export function createHttpChatRepository(): ChatRepository {
  const listeners = new Set<(event: ChatChangeEvent) => void>();
  const emit = (event: ChatChangeEvent) => listeners.forEach((l) => l(event));
  let unsubscribeServer: (() => void) | null = null;

  /** 내 요청이 끝난 직후에도 바로 다시 그리게 한다(SSE 도착을 기다리지 않음) */
  const after = async (roomId: number, request: Promise<unknown>) => {
    await request;
    emit({ type: "changed", roomId });
  };

  return {
    async listRooms() {
      return list(await apiRequest("/api/chats"), "rooms", parseRoom);
    },
    async getRoom(roomId) {
      try {
        return parseRoom(field(await apiRequest(`/api/chats/${roomId}`), "room"));
      } catch (error) {
        if (typeof error === "object" && error !== null && "status" in error && (error.status === 404 || error.status === 403)) return null;
        throw error;
      }
    },
    async openRoomForListing(listingId) {
      const room = parseRoom(field(await apiRequest("/api/chats", { method: "POST", body: { listingId } }), "room"));
      emit({ type: "changed", roomId: room.id });
      return room;
    },
    async listMessages(roomId) {
      return list(await apiRequest(`/api/chats/${roomId}/messages`), "messages", parseMessage);
    },
    sendText: (roomId, text) => after(roomId, apiRequest(`/api/chats/${roomId}/messages`, { method: "POST", body: { text } })),
    sendOffer: (roomId, amount) => after(roomId, apiRequest(`/api/chats/${roomId}/offers`, { method: "POST", body: { amount } })),
    respondOffer: (roomId, messageId, accept) =>
      after(roomId, apiRequest(`/api/chats/${roomId}/offers/${messageId}/${accept ? "accept" : "reject"}`, { method: "POST", body: {} })),
    complete: (roomId) => after(roomId, apiRequest(`/api/chats/${roomId}/complete`, { method: "POST", body: {} })),
    markRead: (roomId) => after(roomId, apiRequest(`/api/chats/${roomId}/read`, { method: "POST", body: {} })),

    subscribe(listener) {
      listeners.add(listener);
      if (!unsubscribeServer) {
        const offChat = onServerEvent("chat.changed", (payload) => emit({ type: "changed", roomId: payload.chatId ?? null }));
        const offResync = onServerEvent("resync", () => emit({ type: "changed", roomId: null }));
        unsubscribeServer = () => {
          offChat();
          offResync();
        };
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && unsubscribeServer) {
          unsubscribeServer();
          unsubscribeServer = null;
        }
      };
    },
  };
}

export const chatRepository: ChatRepository = createHttpChatRepository();
