import fs from "node:fs";
import path from "node:path";
import type {
  ComplexAreaRow,
  ComplexRow,
  DistrictRow,
  FavoriteRow,
  ListingRow,
  SessionRow,
  Store,
  StoreTx,
  TradeChatReadRow,
  TradeChatRow,
  TradeDocumentRow,
  TradeMessageRow,
  TrustReportRow,
  UserRow,
} from "./types";

/**
 * JSON 파일 저장소(.data/jibkog.json). DB가 붙기 전까지 쓰는 개발용 구현체다.
 * - 데이터 전체를 메모리에 두고, write가 끝날 때마다 파일에 저장한다.
 * - write는 한 줄로 세워 순서대로 실행한다(동시 요청이 와도 파일이 섞이지 않는다).
 * - write 도중 오류가 나면 시작 전 상태로 되돌린다(트랜잭션 흉내).
 * - 저장은 임시 파일에 쓴 뒤 이름을 바꿔 교체한다(쓰다가 꺼져도 이전 파일이 남는다).
 */

export type Tables = {
  users: UserRow[];
  sessions: SessionRow[];
  districts: DistrictRow[];
  complexes: ComplexRow[];
  complex_areas: ComplexAreaRow[];
  listings: ListingRow[];
  trade_documents: TradeDocumentRow[];
  trust_reports: TrustReportRow[];
  favorites: FavoriteRow[];
  trade_chats: TradeChatRow[];
  trade_messages: TradeMessageRow[];
  trade_chat_reads: TradeChatReadRow[];
};

type IdTable = "users" | "listings" | "trust_reports" | "trade_chats" | "trade_messages";

type FileData = {
  version: 1;
  /** DB의 IDENTITY 시퀀스 역할 */
  next_ids: Record<IdTable, number>;
  tables: Tables;
};

export function emptyTables(): Tables {
  return {
    users: [], sessions: [], districts: [], complexes: [], complex_areas: [], listings: [],
    trade_documents: [], trust_reports: [], favorites: [], trade_chats: [], trade_messages: [], trade_chat_reads: [],
  };
}

function nextIdsFor(tables: Tables): Record<IdTable, number> {
  const max = (rows: { id: number }[]) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  return {
    users: max(tables.users),
    listings: max(tables.listings),
    trust_reports: max(tables.trust_reports),
    trade_chats: max(tables.trade_chats),
    trade_messages: max(tables.trade_messages),
  };
}

class NotFoundError extends Error {}

function createTx(data: FileData): StoreTx {
  const t = data.tables;
  const nextId = (table: IdTable) => data.next_ids[table]++;
  const copy = <T>(value: T): T => structuredClone(value);
  const mustFind = <T>(rows: T[], pred: (row: T) => boolean, what: string): T => {
    const row = rows.find(pred);
    if (!row) throw new NotFoundError(`${what}을(를) 찾을 수 없어요`);
    return row;
  };

  return {
    async insertUser(row) {
      if (t.users.some((u) => u.email === row.email)) throw new Error("UNIQUE users.email");
      const user = { ...copy(row), id: nextId("users") };
      t.users.push(user);
      return copy(user);
    },
    async findUserById(id) { return copy(t.users.find((u) => u.id === id) ?? null); },
    async findUserByEmail(email) { return copy(t.users.find((u) => u.email === email) ?? null); },

    async insertSession(row) { t.sessions.push(copy(row)); },
    async findSession(tokenHash) { return copy(t.sessions.find((s) => s.token_hash === tokenHash) ?? null); },
    async deleteSession(tokenHash) { t.sessions = t.sessions.filter((s) => s.token_hash !== tokenHash); },
    async deleteExpiredSessions(nowIso) { t.sessions = t.sessions.filter((s) => s.expires_at > nowIso); },

    async listDistricts() { return copy(t.districts); },
    async listComplexes() { return copy(t.complexes); },
    async listComplexAreas() { return copy(t.complex_areas); },
    async findComplex(id) { return copy(t.complexes.find((c) => c.id === id) ?? null); },

    async listTradeListings() { return copy(t.listings); },
    async findListing(id) { return copy(t.listings.find((l) => l.id === id) ?? null); },
    async insertListing(row) {
      const listing = { ...copy(row), id: nextId("listings") };
      t.listings.push(listing);
      return copy(listing);
    },
    async updateListing(id, patch) {
      const row = mustFind(t.listings, (l) => l.id === id, "매물");
      Object.assign(row, copy(patch));
      return copy(row);
    },
    async listTradeDocuments(listingIds) { return copy(t.trade_documents.filter((d) => listingIds.includes(d.listing_id))); },
    async upsertTradeDocument(row) {
      const existing = t.trade_documents.find((d) => d.listing_id === row.listing_id && d.kind === row.kind);
      if (existing) Object.assign(existing, copy(row));
      else t.trade_documents.push(copy(row));
    },
    async insertTrustReport(row) {
      const report = { ...copy(row), id: nextId("trust_reports") };
      t.trust_reports.push(report);
      return copy(report);
    },
    async latestTrustReports(listingIds) {
      const latest = new Map<number, TrustReportRow>();
      for (const r of t.trust_reports) {
        if (!listingIds.includes(r.listing_id)) continue;
        const current = latest.get(r.listing_id);
        if (!current || r.evaluated_at > current.evaluated_at || (r.evaluated_at === current.evaluated_at && r.id > current.id)) latest.set(r.listing_id, r);
      }
      return copy([...latest.values()]);
    },

    async listFavoriteListingIds(userId) { return t.favorites.filter((f) => f.user_id === userId).map((f) => f.listing_id); },
    async addFavorite(row) {
      if (!t.favorites.some((f) => f.user_id === row.user_id && f.listing_id === row.listing_id)) t.favorites.push(copy(row));
    },
    async removeFavorite(row) { t.favorites = t.favorites.filter((f) => !(f.user_id === row.user_id && f.listing_id === row.listing_id)); },

    async listChatsForUser(userId) { return copy(t.trade_chats.filter((c) => c.buyer_id === userId || c.seller_id === userId)); },
    async findChat(id) { return copy(t.trade_chats.find((c) => c.id === id) ?? null); },
    async findChatByListingAndBuyer(listingId, buyerId) {
      return copy(t.trade_chats.find((c) => c.listing_id === listingId && c.buyer_id === buyerId) ?? null);
    },
    async insertChat(row) {
      if (t.trade_chats.some((c) => c.listing_id === row.listing_id && c.buyer_id === row.buyer_id)) throw new Error("UNIQUE trade_chats(listing_id, buyer_id)");
      const chat = { ...copy(row), id: nextId("trade_chats") };
      t.trade_chats.push(chat);
      return copy(chat);
    },
    async updateChat(id, patch) {
      const row = mustFind(t.trade_chats, (c) => c.id === id, "채팅방");
      Object.assign(row, copy(patch));
      return copy(row);
    },
    async countCompletedTradesBySeller(sellerId) { return t.trade_chats.filter((c) => c.seller_id === sellerId && c.deal_status === "done").length; },

    async listMessages(chatId) { return copy(t.trade_messages.filter((m) => m.chat_id === chatId).sort((a, b) => a.id - b.id)); },
    async findMessage(id) { return copy(t.trade_messages.find((m) => m.id === id) ?? null); },
    async lastMessage(chatId) {
      let last: TradeMessageRow | null = null;
      for (const m of t.trade_messages) if (m.chat_id === chatId && (!last || m.id > last.id)) last = m;
      return copy(last);
    },
    async insertMessage(row) {
      if (row.body.trim() === "") throw new Error("CHECK trade_messages.body");
      const message = { ...copy(row), id: nextId("trade_messages") };
      t.trade_messages.push(message);
      return copy(message);
    },
    async updateMessage(id, patch) {
      const row = mustFind(t.trade_messages, (m) => m.id === id, "메시지");
      Object.assign(row, copy(patch));
      return copy(row);
    },
    async supersedePendingOffers(chatId) {
      for (const m of t.trade_messages) if (m.chat_id === chatId && m.kind === "offer" && m.offer_status === "pending") m.offer_status = "superseded";
    },
    async countMessagesAfter(chatId, afterMessageId, authorRole) {
      return t.trade_messages.filter((m) => m.chat_id === chatId && m.id > afterMessageId && m.author_role === authorRole).length;
    },

    async findRead(chatId, userId) { return copy(t.trade_chat_reads.find((r) => r.chat_id === chatId && r.user_id === userId) ?? null); },
    async upsertRead(row) {
      const existing = t.trade_chat_reads.find((r) => r.chat_id === row.chat_id && r.user_id === row.user_id);
      if (existing) existing.last_read_message_id = Math.max(existing.last_read_message_id, row.last_read_message_id);
      else t.trade_chat_reads.push(copy(row));
    },
  };
}

export function createJsonFileStore(filePath: string, seed: () => Tables): Store {
  let data: FileData | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  function persist(next: FileData): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 1));
    fs.renameSync(tmp, filePath);
  }

  function load(): FileData {
    if (data) return data;
    if (fs.existsSync(filePath)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (typeof parsed === "object" && parsed !== null && "tables" in parsed && "next_ids" in parsed) {
        data = parsed as FileData; // 이 서버가 쓴 파일만 읽는다
        return data;
      }
      throw new Error(`${filePath} 형식을 알 수 없어요`);
    }
    // 처음 실행: 시드 데이터를 넣는다
    const tables = seed();
    data = { version: 1, next_ids: nextIdsFor(tables), tables };
    persist(data);
    return data;
  }

  /** 앞의 작업이 끝난 뒤에 실행한다(읽기도 쓰기 도중 상태를 보지 않도록 같은 줄에 세운다). */
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = queue.then(job, job);
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    read(work) {
      return enqueue(async () => work(createTx(structuredClone(load()))));
    },
    write(work) {
      return enqueue(async () => {
        const current = load();
        const draft = structuredClone(current);
        const result = await work(createTx(draft));
        persist(draft);
        data = draft;
        return result;
      });
    },
  };
}
