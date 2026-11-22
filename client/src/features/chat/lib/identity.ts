import type { ChatParticipant, ChatRole, ChatRoom } from "../types";

/** 로그인이 없으므로 이 기기 사용자를 "me"로 둔다. 로그인이 붙으면 인증 사용자 id로 바꾼다. */
export const ME_ID = "me";

/** 매물 판매자의 참여자 id(로그인 전 임시). 내 매물이면 ME_ID */
export function sellerParticipantId(listingId: number, isMine: boolean): string {
  return isMine ? ME_ID : `seller:${listingId}`;
}

export function myParticipant(name: string): ChatParticipant {
  return { id: ME_ID, name };
}

/** 이 방에서 내 기본 역할 */
export function defaultRole(room: ChatRoom): ChatRole {
  return room.seller.id === ME_ID && room.buyer.id !== ME_ID ? "seller" : "buyer";
}

const ROLE_OVERRIDE_PREFIX = "zipcok.chat.role.";

/**
 * 개발용 "상대로 보기": 탭마다(sessionStorage) 이 방에서 맡을 역할을 바꾼다.
 * 같은 브라우저의 다른 탭에서 판매자 역할로 대화를 확인할 때 쓴다.
 */
export function viewerRole(room: ChatRoom): ChatRole {
  if (import.meta.env.DEV) {
    try {
      const stored = window.sessionStorage.getItem(ROLE_OVERRIDE_PREFIX + room.id);
      if (stored === "buyer" || stored === "seller") return stored;
    } catch {
      // sessionStorage를 못 쓰면 기본 역할
    }
  }
  return defaultRole(room);
}

export function setViewerRole(roomId: string, role: ChatRole): void {
  if (!import.meta.env.DEV) return;
  try {
    window.sessionStorage.setItem(ROLE_OVERRIDE_PREFIX + roomId, role);
  } catch {
    // 무시
  }
}

export function counterpart(room: ChatRoom, role: ChatRole): { participant: ChatParticipant; label: string } {
  return role === "buyer" ? { participant: room.seller, label: "판매자" } : { participant: room.buyer, label: "구매자" };
}

/** 아바타 두 글자 */
export function avatarText(name: string): string {
  const trimmed = name.trim();
  return /^[가-힣]{3}$/.test(trimmed) ? trimmed.slice(1) : trimmed.slice(0, 2);
}
