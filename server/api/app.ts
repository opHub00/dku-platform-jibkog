import type { IncomingMessage, ServerResponse } from "node:http";
import { clearSessionCookie, parseCookies, SESSION_COOKIE, sessionCookie } from "../auth";
import path from "node:path";
import { createLiveCatalog } from "../catalog/live";
import { parseBounds, parseComplexQuery, parseNoticeQuery, parseRecentDays } from "../catalog/source";
import { syncCatalogExamples } from "../catalog/store";
import { EventHub } from "../realtime";
import { createJsonFileStore } from "../store/jsonFileStore";
import { createPostgresStore } from "../store/postgresStore";
import { buildSeedTables } from "../store/seed";
import type { Store, UserRow } from "../store/types";
import { ApiError, notFound, readJson, sendError, sendJson } from "./http";
import * as svc from "./services";

/**
 * 앱 API(/api/auth, /api/complexes, /api/listings, /api/chats, /api/events, /api/catalog, /api/map).
 * 문서: docs/api.md, docs/api-catalog.md. 저장소는 Store 인터페이스만 쓴다(DATABASE_URL이 있으면 PostgreSQL, 없으면 JSON 파일).
 */

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  token: string | undefined;
  user: UserRow | null;
};

type Handler = (ctx: Ctx) => Promise<void>;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
    keys.push(key);
    return "([0-9]+)";
  });
  return { pattern: new RegExp(`^${source}$`), keys };
}

function id(ctx: Ctx, key: string): number {
  const value = Number(ctx.params[key]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new ApiError(400, "bad_request", `${key}가 올바르지 않아요`);
  return value;
}

export function createAppApi(options: { dataFile: string; databaseUrl?: string; dbDir?: string; seedDemo?: boolean; log?: (message: string) => void; catalogTest?: { keys: { applyhome: string | null; kakao: string | null }; fetchImpl: typeof fetch; minIntervalMs?: number } }) {
  const postgres = options.databaseUrl ? createPostgresStore({ databaseUrl: options.databaseUrl, dbDir: options.dbDir!, seed: options.seedDemo ? buildSeedTables : undefined, log: options.log }) : null;
  const store: Store = postgres ?? createJsonFileStore(options.dataFile, () => buildSeedTables());
  const hub = new EventHub();
  const routes: Route[] = [];
  const route = (method: string, path: string, handler: Handler) => routes.push({ method, ...compile(path), handler });

  const live = createLiveCatalog({
    envDir: path.dirname(path.dirname(options.dataFile)),
    cacheFile: path.join(path.dirname(options.dataFile), "catalog.json"),
    log: options.log,
    ...options.catalogTest,
  });
  const catalog = live.catalog;
  const catalogReady = live.seedCandidates().then((details) => details.length ? syncCatalogExamples(store, details, options.log) : 0)
    .catch((error: unknown) => { options.log?.(`청약 예시 매물 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`); });
  const query = (req: IncomingMessage) => new URL(req.url ?? "/", "http://localhost").searchParams;

  const notifyChat = (change: svc.ChatChange) =>
    hub.publishTo([change.chat.buyer_id, change.chat.seller_id], { type: "chat.changed", chatId: change.chat.id });

  // ---------- 인증 ----------
  route("POST", "/api/auth/signup", async ({ req, res }) => {
    const { user, token } = await svc.signup(store, await readJson(req));
    sendJson(res, 201, { user }, { "Set-Cookie": sessionCookie(token) });
  });
  route("POST", "/api/auth/login", async ({ req, res }) => {
    const { user, token } = await svc.login(store, await readJson(req));
    sendJson(res, 200, { user }, { "Set-Cookie": sessionCookie(token) });
  });
  route("POST", "/api/auth/logout", async ({ res, token }) => {
    await svc.logout(store, token);
    sendJson(res, 204, null, { "Set-Cookie": clearSessionCookie() });
  });
  route("GET", "/api/auth/me", async ({ res, user }) => {
    sendJson(res, 200, { user: svc.toAuthUser(svc.requireUser(user)) });
  });
  route("POST", "/api/auth/verify-identity", async ({ req, res, user }) => {
    const me = svc.requireUser(user);
    sendJson(res, 200, { user: await svc.verifyIdentity(store, me.id, await readJson(req)) });
  });

  // ---------- 단지·매물 ----------
  route("GET", "/api/complexes", async ({ res }) => { await catalogReady; sendJson(res, 200, { complexes: await svc.listComplexes(store) }); });
  route("GET", "/api/listings", async ({ res, user }) => { await catalogReady; sendJson(res, 200, { listings: await svc.listListings(store, user?.id ?? null) }); });
  route("POST", "/api/listings", async ({ req, res, user }) => {
    await catalogReady;
    const me = svc.requireUser(user);
    const listing = await svc.createListing(store, me.id, await readJson(req), catalog);
    hub.publishAll({ type: "listing.changed", listingId: listing.id });
    sendJson(res, 201, { listing });
  });
  route("GET", "/api/listings/:id", async (ctx) => { await catalogReady; sendJson(ctx.res, 200, { listing: await svc.getListing(store, ctx.user?.id ?? null, id(ctx, "id")) }); });
  route("PATCH", "/api/listings/:id", async (ctx) => {
    const me = svc.requireUser(ctx.user);
    const listing = await svc.updateListing(store, me.id, id(ctx, "id"), await readJson(ctx.req));
    hub.publishAll({ type: "listing.changed", listingId: listing.id });
    sendJson(ctx.res, 200, { listing });
  });
  route("PUT", "/api/listings/:id/favorite", async (ctx) => {
    const me = svc.requireUser(ctx.user);
    const listingId = id(ctx, "id");
    const result = await svc.setFavorite(store, me.id, listingId, await readJson(ctx.req));
    hub.publishTo([me.id], { type: "listing.changed", listingId });
    sendJson(ctx.res, 200, result);
  });

  // ---------- 청약 카탈로그·지도(docs/api-catalog.md) ----------
  route("GET", "/api/catalog/complexes", async ({ req, res }) => { await catalogReady; sendJson(res, 200, await catalog.searchComplexes(parseComplexQuery(query(req)))); });
  // 카탈로그 단지 id는 숫자만이라고 가정하지 않는다
  routes.push({
    method: "GET",
    pattern: /^\/api\/catalog\/complexes\/([A-Za-z0-9_-]{1,64})$/,
    keys: ["id"],
    handler: async ({ res, params }) => {
      await catalogReady;
      const complex = await catalog.getComplex(params.id ?? "");
      if (!complex) throw notFound("단지");
      sendJson(res, 200, { complex });
    },
  });
  route("GET", "/api/catalog/notices", async ({ req, res }) => { await catalogReady; sendJson(res, 200, { notices: await catalog.listNotices(parseNoticeQuery(query(req))) }); });
  route("GET", "/api/map/markers", async ({ req, res }) => { await catalogReady; sendJson(res, 200, await catalog.mapMarkers(store, parseBounds(query(req)), { recentDays: parseRecentDays(query(req)) })); });

  // ---------- 채팅 ----------
  route("GET", "/api/chats", async ({ res, user }) => sendJson(res, 200, { rooms: await svc.listChats(store, svc.requireUser(user).id) }));
  route("POST", "/api/chats", async ({ req, res, user }) => {
    const me = svc.requireUser(user);
    const { room, created } = await svc.openChat(store, me.id, await readJson(req));
    if (created) hub.publishTo([me.id, room.counterpart.id], { type: "chat.changed", chatId: room.id });
    sendJson(res, created ? 201 : 200, { room });
  });
  route("GET", "/api/chats/:id", async (ctx) => sendJson(ctx.res, 200, { room: await svc.getChat(store, svc.requireUser(ctx.user).id, id(ctx, "id")) }));
  route("GET", "/api/chats/:id/messages", async (ctx) =>
    sendJson(ctx.res, 200, { messages: await svc.listMessages(store, svc.requireUser(ctx.user).id, id(ctx, "id")) }),
  );
  route("POST", "/api/chats/:id/messages", async (ctx) => {
    const change = await svc.sendText(store, svc.requireUser(ctx.user).id, id(ctx, "id"), await readJson(ctx.req));
    notifyChat(change);
    sendJson(ctx.res, 201, { message: change.message });
  });
  route("POST", "/api/chats/:id/offers", async (ctx) => {
    const change = await svc.sendOffer(store, svc.requireUser(ctx.user).id, id(ctx, "id"), await readJson(ctx.req));
    notifyChat(change);
    sendJson(ctx.res, 201, { message: change.message });
  });
  route("POST", "/api/chats/:id/offers/:messageId/accept", async (ctx) => {
    notifyChat(await svc.respondOffer(store, svc.requireUser(ctx.user).id, id(ctx, "id"), id(ctx, "messageId"), true));
    sendJson(ctx.res, 204, null);
  });
  route("POST", "/api/chats/:id/offers/:messageId/reject", async (ctx) => {
    notifyChat(await svc.respondOffer(store, svc.requireUser(ctx.user).id, id(ctx, "id"), id(ctx, "messageId"), false));
    sendJson(ctx.res, 204, null);
  });
  route("POST", "/api/chats/:id/read", async (ctx) => {
    const me = svc.requireUser(ctx.user);
    const change = await svc.markRead(store, me.id, id(ctx, "id"));
    // 읽음은 내 다른 기기·탭의 안 읽은 수만 바꾼다
    hub.publishTo([me.id], { type: "chat.changed", chatId: change.chat.id });
    sendJson(ctx.res, 204, null);
  });
  route("POST", "/api/chats/:id/complete", async (ctx) => {
    notifyChat(await svc.completeChat(store, svc.requireUser(ctx.user).id, id(ctx, "id")));
    sendJson(ctx.res, 204, null);
  });

  // ---------- 실시간(SSE) ----------
  route("GET", "/api/events", async ({ res, user }) => {
    hub.connect(svc.requireUser(user).id, res);
  });

  return {
    store,
    close: () => postgres?.close(),
    hub,
    /** connect 미들웨어. /api/ 중 앱 API가 아니면 next()로 넘긴다(/api/ai, /api/news는 기존 플러그인) */
    async middleware(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
      const url = (req.url ?? "").split("?")[0];
      if (!/^\/api\/(auth|complexes|listings|chats|events|catalog|map)(\/|$)/.test(url)) {
        next();
        return;
      }
      const matched = routes.filter((r) => r.pattern.test(url));
      if (matched.length === 0) {
        sendError(res, new ApiError(404, "not_found", "없는 API예요"));
        return;
      }
      const found = matched.find((r) => r.method === req.method);
      if (!found) {
        res.setHeader("Allow", matched.map((r) => r.method).join(", "));
        sendError(res, new ApiError(405, "method_not_allowed", "지원하지 않는 메서드예요"));
        return;
      }
      const values = found.pattern.exec(url)?.slice(1) ?? [];
      const params = Object.fromEntries(found.keys.map((key, i) => [key, values[i]]));
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      try {
        const user = await svc.userFromToken(store, token);
        await found.handler({ req, res, params, token, user });
      } catch (error) {
        if (error instanceof ApiError) {
          sendError(res, error);
          return;
        }
        options.log?.(`[zipcok-api] ${req.method} ${url}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        sendError(res, new ApiError(500, "internal_error", "서버 오류가 났어요"));
      }
    },
  };
}
