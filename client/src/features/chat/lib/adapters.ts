import { formatWon } from "@/features/presale/lib/format";
import { CHAT_STATUS_LABELS, type TradeChatMessage, type TradeChatRoom } from "../tradeTypes";
import type { ChatMessage, ChatThread } from "../types";
import { formatBubbleTime, formatChatListTime } from "./format";
import { ROLE_LABELS } from "./names";

/**
 * 서버 거래 채팅 데이터(tradeTypes) → 프론트 담당 화면 타입(types.ts의 ChatThread·ChatMessage).
 * 화면(pages/ChatRoom.tsx 등)은 변환된 타입만 본다.
 */

export const TRADE_THREAD_PREFIX = "trade-";

export function tradeThreadId(roomId: number): string {
  return `${TRADE_THREAD_PREFIX}${roomId}`;
}

/** 서버 메시지 하나 → 말풍선. 보낸 역할이 내 역할이면 "me" */
export function toChatMessage(message: TradeChatMessage, myRole: TradeChatRoom["myRole"]): ChatMessage {
  const base = { id: String(message.id), time: formatBubbleTime(message.createdAt) };
  if (message.kind === "system") return { ...base, sender: "other", kind: "system", text: message.text };
  const sender = message.senderRole === myRole ? "me" : "other";
  if (message.kind === "offer") {
    return {
      ...base,
      sender,
      kind: "offer",
      text: `가격 제안 ${formatWon(message.amount)}`,
      offer: { messageId: message.id, amount: message.amount, baseAmount: message.baseAmount, status: message.status },
    };
  }
  return { ...base, sender, kind: "text", text: message.text };
}

/**
 * 서버 대화방 → ChatThread.
 * messages를 주면 대화방 화면용(전체 메시지), 안 주면 목록용(마지막 메시지 한 줄만).
 */
export function toChatThread(
  room: TradeChatRoom,
  options: { messages?: TradeChatMessage[]; listingPrice?: string; listingImage?: string } = {},
): ChatThread {
  const counterpartRole = room.myRole === "buyer" ? "seller" : "buyer";
  const messages: ChatMessage[] = options.messages
    ? options.messages.map((m) => toChatMessage(m, room.myRole))
    : room.lastMessage
      ? [{
          id: "last",
          sender: room.lastMessage.senderRole === room.myRole ? "me" : "other",
          text: room.lastMessage.preview,
          time: formatChatListTime(room.lastMessage.at),
        }]
      : [];
  return {
    id: tradeThreadId(room.id),
    kind: "seller",
    name: room.counterpart.nickname,
    subtitle: `${ROLE_LABELS[counterpartRole]} · ${CHAT_STATUS_LABELS[room.status]}`,
    listingTitle: room.listingTitle,
    listingPrice: options.listingPrice,
    listingImage: options.listingImage,
    messages,
    roomId: room.id,
    listingId: room.listingId,
    status: room.status,
    myRole: room.myRole,
    unread: room.unread,
  };
}
