import type { ServerResponse } from "node:http";

/**
 * 실시간 이벤트(SSE: Server-Sent Events). GET /api/events 연결을 사용자별로 들고 있다가 보낸다.
 * 이벤트는 "무엇이 바뀌었는지"만 알린다. 브라우저는 받은 뒤 해당 API를 다시 불러 최신 상태를 얻는다.
 */
export type ServerEvent =
  | { type: "chat.changed"; chatId: number }
  | { type: "listing.changed"; listingId: number };

const HEARTBEAT_MS = 25_000;
/** 끊겼을 때 브라우저(EventSource)가 다시 연결하기까지 기다리는 시간 */
const RETRY_MS = 3_000;

export class EventHub {
  private readonly clients = new Map<number, Set<ServerResponse>>();

  connect(userId: number, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: ${RETRY_MS}\n`);
    res.write(`event: ready\ndata: {}\n\n`);
    const set = this.clients.get(userId) ?? new Set<ServerResponse>();
    set.add(res);
    this.clients.set(userId, set);
    const heartbeat = setInterval(() => res.write(`: ping\n\n`), HEARTBEAT_MS);
    res.on("close", () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) this.clients.delete(userId);
    });
  }

  private write(res: ServerResponse, event: ServerEvent): void {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  /** 특정 사용자들(예: 채팅방 당사자)에게만 보낸다 */
  publishTo(userIds: number[], event: ServerEvent): void {
    for (const userId of new Set(userIds)) for (const res of this.clients.get(userId) ?? []) this.write(res, event);
  }

  /** 접속한 모두에게 보낸다(공개 매물 변경 등) */
  publishAll(event: ServerEvent): void {
    for (const set of this.clients.values()) for (const res of set) this.write(res, event);
  }

  get connectionCount(): number {
    let count = 0;
    for (const set of this.clients.values()) count += set.size;
    return count;
  }
}
