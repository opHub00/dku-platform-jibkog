import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/lib/session";
import { chatRepository } from "../api/chatRepository";
import type { ChatMessage, ChatRoom } from "../types";

/** 내 대화방 목록. 로그인 안 했으면 빈 목록. 이 기기·다른 기기에서 바뀌면 다시 읽는다. */
export function useChatRooms(): ChatRoom[] | null {
  const { user, loaded } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      setRooms([]);
      return;
    }
    let active = true;
    const load = () =>
      void chatRepository
        .listRooms()
        .then((r) => active && setRooms(r))
        .catch(() => active && setRooms([]));
    load();
    const unsubscribe = chatRepository.subscribe(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.id, loaded]);
  return rooms;
}

/** 대화방 하나와 메시지. 이 방이 바뀌면 다시 읽는다. */
export function useChatRoom(roomId: number): { room: ChatRoom | null; messages: ChatMessage[]; loaded: boolean } {
  const [state, setState] = useState<{ room: ChatRoom | null; messages: ChatMessage[]; loaded: boolean }>({ room: null, messages: [], loaded: false });
  useEffect(() => {
    let active = true;
    const load = () =>
      void Promise.all([chatRepository.getRoom(roomId), chatRepository.listMessages(roomId).catch(() => [])])
        .then(([room, messages]) => active && setState({ room, messages, loaded: true }))
        .catch(() => active && setState({ room: null, messages: [], loaded: true }));
    load();
    const unsubscribe = chatRepository.subscribe((event) => {
      if (event.roomId === null || event.roomId === roomId) load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [roomId]);
  return state;
}

/**
 * 모바일 가상 키보드가 올라왔을 때 화면 아래가 가려지는 높이(px).
 * 하단 입력창을 이만큼 올려 키보드와 겹치지 않게 한다.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}
