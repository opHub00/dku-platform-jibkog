import { getAuthState, subscribeAuth } from "./session";

/**
 * 서버 실시간 이벤트(SSE, GET /api/events). 로그인한 동안만 연결한다.
 * - 끊기면 브라우저(EventSource)가 자동으로 다시 연결한다(서버가 retry: 3000을 보낸다).
 * - 다시 연결되면 "resync"를 알린다. 끊긴 동안 놓친 변경을 다시 불러오라는 뜻이다.
 */
export type ServerEventType = "chat.changed" | "listing.changed" | "resync";
export type ServerEventPayload = { chatId?: number; listingId?: number };

const listeners = new Map<ServerEventType, Set<(payload: ServerEventPayload) => void>>();
let source: EventSource | null = null;
let hadError = false;
let started = false;

function emit(type: ServerEventType, payload: ServerEventPayload): void {
  listeners.get(type)?.forEach((listener) => listener(payload));
}

function parse(data: string): ServerEventPayload {
  try {
    const value: unknown = JSON.parse(data);
    if (typeof value !== "object" || value === null) return {};
    const chatId = "chatId" in value && typeof value.chatId === "number" ? value.chatId : undefined;
    const listingId = "listingId" in value && typeof value.listingId === "number" ? value.listingId : undefined;
    return { chatId, listingId };
  } catch {
    return {};
  }
}

function connect(): void {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/api/events", { withCredentials: true });
  source.addEventListener("ready", () => {
    if (hadError) emit("resync", {});
    hadError = false;
  });
  source.addEventListener("chat.changed", (event) => emit("chat.changed", parse((event as MessageEvent<string>).data)));
  source.addEventListener("listing.changed", (event) => emit("listing.changed", parse((event as MessageEvent<string>).data)));
  source.addEventListener("error", () => {
    hadError = true;
  });
}

function disconnect(): void {
  source?.close();
  source = null;
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  const sync = () => (getAuthState().user ? connect() : disconnect());
  subscribeAuth((auth) => {
    // 계정이 바뀌면 새 쿠키로 다시 연결
    disconnect();
    if (auth.user) connect();
    emit("resync", {});
  });
  sync();
}

export function onServerEvent(type: ServerEventType, listener: (payload: ServerEventPayload) => void): () => void {
  start();
  const set = listeners.get(type) ?? new Set();
  set.add(listener);
  listeners.set(type, set);
  return () => set.delete(listener);
}
