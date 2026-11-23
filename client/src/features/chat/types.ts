import type { ChatRole, ChatRoomStatus, OfferStatus } from "./tradeTypes";

export type ChatMessageSender = "me" | "other";

export type ChatMessage = {
  id: string;
  sender: ChatMessageSender;
  text: string;
  time: string;
  // ---- 아래는 거래 채팅(서버 연동)에만 쓰는 선택 필드 ----
  /** 메시지 종류. 없으면 일반 글(text) */
  kind?: "text" | "offer" | "system";
  /** kind가 offer일 때: 가격 제안 카드 내용 */
  offer?: {
    /** 서버 메시지 id(수락·거절 요청에 씀) */
    messageId: number;
    /** 제안한 총 매수가(원) */
    amount: number;
    /** 제안 당시 총 필요자금(원) */
    baseAmount: number;
    status: OfferStatus;
  };
};

export type ChatThreadKind = "ai" | "seller";

export type ChatThread = {
  id: string;
  kind: ChatThreadKind;
  name: string;
  subtitle: string;
  listingTitle?: string;
  listingPrice?: string;
  listingImage?: string;
  messages: ChatMessage[];
  // ---- 아래는 거래 채팅(서버 연동)에만 쓰는 선택 필드 ----
  /** 서버 대화방 id */
  roomId?: number;
  /** 매물 id(상단 카드를 누르면 상세로) */
  listingId?: number;
  /** 거래 상태: 문의중·가격협의·계약진행·완료 */
  status?: ChatRoomStatus;
  /** 이 방에서 내 역할(서버가 로그인 정보로 정함) */
  myRole?: ChatRole;
  /** 내가 안 읽은 메시지 수 */
  unread?: number;
};
