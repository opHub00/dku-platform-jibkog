/** 대화방 안에서의 역할. 로그인이 붙기 전까지 보낸 사람은 역할로 구분한다. */
export type ChatRole = "buyer" | "seller";

export type ChatParticipant = {
  /** 지금은 "me"(이 기기 사용자) 또는 "seller:<매물 id>". 로그인이 붙으면 사용자 id */
  id: string;
  name: string;
};

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

export type ChatRoom = {
  id: string;
  listingId: number;
  /** 목록에 보여줄 매물 요약(생성 시점) */
  listingTitle: string;
  buyer: ChatParticipant;
  seller: ChatParticipant;
  status: ChatRoomStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage: { preview: string; at: string; senderRole: ChatRole | "system" } | null;
  /** 역할별 안 읽은 메시지 수 */
  unread: Record<ChatRole, number>;
};

export type OfferStatus = "pending" | "accepted" | "rejected" | "superseded";

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: "답변 대기",
  accepted: "수락됨",
  rejected: "거절됨",
  superseded: "새 제안으로 바뀜",
};

export type ChatMessage =
  | { id: string; roomId: string; kind: "text"; senderRole: ChatRole; text: string; createdAt: string }
  | {
      id: string;
      roomId: string;
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
  | { id: string; roomId: string; kind: "system"; senderRole: "system"; text: string; createdAt: string };

export type ChatChangeEvent = { type: "changed"; roomId: string | null };
