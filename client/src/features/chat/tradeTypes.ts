/**
 * 거래 채팅의 서버 응답 형식(docs/api.md). 서버(server/api)와 함께 쓰므로 "@/" 경로 import를 두지 않는다.
 * 화면은 이 타입을 직접 쓰지 않고, lib/adapters.ts로 화면 타입(types.ts의 ChatThread·ChatMessage)으로 바꿔 쓴다.
 * 구매자/판매자 역할은 서버가 로그인 정보로 정해서 내려준다(myRole).
 */
export type ChatRole = "buyer" | "seller";

/** 거래 상태: 문의중 → 가격협의 → 계약진행 → 완료 */
export type ChatRoomStatus = "inquiry" | "negotiating" | "contracting" | "done";

export const CHAT_STATUS_LABELS: Record<ChatRoomStatus, string> = {
  inquiry: "문의중",
  negotiating: "가격협의",
  contracting: "계약진행",
  done: "완료",
};

export const CHAT_STATUS_TONES: Record<ChatRoomStatus, "green" | "sand" | "navy" | "neutral"> = {
  inquiry: "green",
  negotiating: "sand",
  contracting: "navy",
  done: "neutral",
};

export type TradeChatRoom = {
  id: number;
  listingId: number;
  listingTitle: string;
  /** 이 방에서 내 역할 */
  myRole: ChatRole;
  /** 상대방(닉네임만 공개) */
  counterpart: { id: number; nickname: string };
  status: ChatRoomStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage: { preview: string; at: string; senderRole: ChatRole | "system" } | null;
  /** 내가 안 읽은 메시지 수 */
  unread: number;
};

export type OfferStatus = "pending" | "accepted" | "rejected" | "superseded";

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: "답변 대기",
  accepted: "수락됨",
  rejected: "거절됨",
  superseded: "새 제안으로 바뀜",
};

export type TradeChatMessage =
  | { id: number; roomId: number; kind: "text"; senderRole: ChatRole; text: string; createdAt: string }
  | {
      id: number;
      roomId: number;
      kind: "offer";
      senderRole: ChatRole;
      /** 제안한 총 매수가(원) */
      amount: number;
      /** 제안 당시 총 필요자금(원) */
      baseAmount: number;
      status: OfferStatus;
      respondedAt: string | null;
      createdAt: string;
    }
  | { id: number; roomId: number; kind: "system"; senderRole: "system"; text: string; createdAt: string };

export type ChatChangeEvent = { type: "changed"; roomId: number | null };
