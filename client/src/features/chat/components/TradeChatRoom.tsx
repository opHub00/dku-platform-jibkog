import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChatRoomView } from "@/pages/ChatRoom";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { toListing } from "@/features/presale/lib/toListing";
import { chatRepository } from "../api/chatRepository";
import { toChatThread } from "../lib/adapters";
import { useChatRoom } from "../lib/useChat";

/**
 * 거래 채팅방: 서버 대화방(API·SSE)을 프론트 담당 대화방 화면(ChatRoomView)에 연결한다.
 * 화면은 그대로 쓰고, 서버 데이터는 lib/adapters.ts로 ChatThread에 맞춘다.
 */
export function TradeChatRoom({
  roomId,
  onBack,
  onOpenListing,
}: {
  roomId: number;
  onBack: () => void;
  onOpenListing: (listingId: number) => void;
}) {
  const { room, messages, loaded } = useChatRoom(roomId);
  const [listingView, setListingView] = useState<{ price: string; image: string } | null>(null);

  useEffect(() => {
    if (!room) return;
    let active = true;
    void presaleRepository.getListing(room.listingId).then(async (listing) => {
      const complex = listing ? await presaleRepository.getComplex(listing.complexId) : null;
      if (active && listing && complex) {
        const view = toListing(listing, complex);
        setListingView({ price: view.price, image: view.image });
      }
    });
    return () => {
      active = false;
    };
  }, [room?.listingId]);

  // 보고 있는 동안 온 메시지는 읽음 처리(안 읽은 수 갱신)
  useEffect(() => {
    if (room && room.unread > 0 && document.visibilityState === "visible") void chatRepository.markRead(room.id);
  }, [room]);

  // 없는 방(삭제·권한 없음)이면 안내하고 닫는다
  useEffect(() => {
    if (loaded && !room) {
      toast("대화방을 찾을 수 없어요");
      onBack();
    }
  }, [loaded, room]);

  if (!loaded || !room) return <div className="chatroom-screen" />;

  const thread = toChatThread(room, { messages, listingPrice: listingView?.price, listingImage: listingView?.image });
  const report = (error: unknown, fallback: string) => toast.error(error instanceof Error ? error.message : fallback);

  return (
    <ChatRoomView
      thread={thread}
      onBack={onBack}
      onSend={(text) => void chatRepository.sendText(room.id, text).catch((e: unknown) => report(e, "보내지 못했어요"))}
      onRespondOffer={(messageId, accept) =>
        void chatRepository
          .respondOffer(room.id, messageId, accept)
          .then(() => toast(accept ? "가격 제안을 수락했어요" : "가격 제안을 거절했어요"))
          .catch((e: unknown) => report(e, "답하지 못했어요"))
      }
      onComplete={() => void chatRepository.complete(room.id).catch((e: unknown) => report(e, "바꾸지 못했어요"))}
      onOpenListing={() => onOpenListing(room.listingId)}
    />
  );
}
