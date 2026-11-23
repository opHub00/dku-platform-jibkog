import type { AuthUser } from "../../client/src/features/auth/types";
import type { ChatMessage, ChatRole, ChatRoom } from "../../client/src/features/chat/types";
import { isResaleRestricted } from "../../client/src/features/presale/lib/resale";
import { formatWon } from "../../client/src/features/presale/lib/format";
import type { Complex, PresaleDocument, PresaleListing, Sido, TrustReport } from "../../client/src/features/presale/types";
import { hashPassword, hashToken, newSessionToken, SESSION_DAYS, verifyPassword } from "../auth";
import type {
  ComplexAreaRow,
  ComplexRow,
  DistrictRow,
  ListingRow,
  Store,
  StoreTx,
  TradeChatRow,
  TradeDocumentKind,
  TradeDocumentRow,
  TradeMessageRow,
  TrustReportRow,
  UserRow,
} from "../store/types";
import { ApiError, badRequest, conflict, forbidden, intField, isRecord, notFound, requireRecord, stringField, unauthorized } from "./http";

/**
 * 서비스 계층: 모든 권한 규칙과 업무 규칙은 여기서 판단한다(저장소는 데이터만 다룬다).
 * 사용자 id는 항상 세션 쿠키로 서버가 확인한 값만 받는다.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOCUMENT_KINDS: readonly TradeDocumentKind[] = ["salesContract", "paymentProof", "optionContract"];
const DOCUMENT_STATUSES = ["verified", "pending", "missing"] as const;
const REVIEW_THRESHOLD_SCORE = 50;
const MAX_TEXT_LENGTH = 500;
const MAX_WON = 1_000_000_000_000_000; // 1000조: 안전한 정수 범위 안

// ---------- 변환(DTO) ----------

export function toAuthUser(user: UserRow): AuthUser {
  return { id: user.id, email: user.email, nickname: user.nickname, realName: user.real_name, identityVerified: user.identity_verified };
}

/** 다른 사람에게는 실명 가운데를 가린다: 김서연 → 김*연, 이도 → 이* */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return "*";
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${"*".repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function isSido(value: string): value is Sido {
  return value === "서울" || value === "경기" || value === "인천";
}

function toComplex(row: ComplexRow, district: DistrictRow | undefined, areas: ComplexAreaRow[]): Complex | null {
  if (!district || !isSido(district.sido)) return null;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    sido: district.sido,
    sigungu: district.sigungu,
    lat: row.latitude ?? 0,
    lng: row.longitude ?? 0,
    moveInMonth: row.move_in_month ?? "",
    resaleRestrictionEndsOn: row.resale_restriction_ends_on,
    supplyAreas: areas.filter((a) => a.complex_id === row.id).map((a) => a.area_m2).sort((a, b) => a - b),
    referencePremiumRate: row.reference_premium_rate ?? 0,
    image: row.image ?? "/assets/modern-home.jpg",
  };
}

function isTrustReport(value: unknown): value is TrustReport {
  return (
    isRecord(value) &&
    typeof value.score === "number" &&
    typeof value.rawScore === "number" &&
    typeof value.grade === "string" &&
    typeof value.tradable === "boolean" &&
    Array.isArray(value.caps) &&
    Array.isArray(value.items) &&
    (value.mode === "live" || value.mode === "demo") &&
    typeof value.evaluatedAt === "string"
  );
}

type ListingContext = {
  viewerId: number | null;
  sellers: Map<number, UserRow>;
  tradeCounts: Map<number, number>;
  documents: TradeDocumentRow[];
  reports: TrustReportRow[];
  likedIds: Set<number>;
};

function toPresaleListing(row: ListingRow, ctx: ListingContext): PresaleListing {
  const seller = ctx.sellers.get(row.seller_id);
  const isMine = ctx.viewerId === row.seller_id;
  const baseName = seller?.real_name ?? seller?.nickname ?? "판매자";
  const documents: PresaleDocument[] = DOCUMENT_KINDS.map((kind) => ({
    type: kind,
    status: ctx.documents.find((d) => d.listing_id === row.id && d.kind === kind)?.status ?? "missing",
  }));
  const report = ctx.reports.find((r) => r.listing_id === row.id);
  return {
    id: row.id,
    complexId: row.complex_id,
    seller: {
      id: row.seller_id,
      nickname: seller?.nickname ?? "판매자",
      realName: isMine ? baseName : maskName(baseName),
      identityVerified: seller?.identity_verified ?? false,
      tradeCount: ctx.tradeCounts.get(row.seller_id) ?? 0,
    },
    area: row.area_m2,
    floor: row.floor ?? 0,
    salePrice: row.sale_price,
    premium: row.premium,
    optionCost: row.option_cost,
    paidAmount: row.paid_amount,
    description: row.description,
    documents,
    status: row.status,
    liked: ctx.likedIds.has(row.id),
    createdAt: row.created_at,
    ...(report && isTrustReport(report.report_json) ? { trust: report.report_json } : {}),
    isMine,
  };
}

async function listingContext(tx: StoreTx, rows: ListingRow[], viewerId: number | null): Promise<ListingContext> {
  const ids = rows.map((r) => r.id);
  const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
  const sellers = new Map<number, UserRow>();
  const tradeCounts = new Map<number, number>();
  for (const id of sellerIds) {
    const user = await tx.findUserById(id);
    if (user) sellers.set(id, user);
    tradeCounts.set(id, await tx.countCompletedTradesBySeller(id));
  }
  return {
    viewerId,
    sellers,
    tradeCounts,
    documents: await tx.listTradeDocuments(ids),
    reports: await tx.latestTrustReports(ids),
    likedIds: new Set(viewerId === null ? [] : await tx.listFavoriteListingIds(viewerId)),
  };
}

/** 검토 대기(review) 매물은 판매자 본인에게만 보인다 */
function isVisible(row: ListingRow, viewerId: number | null): boolean {
  return row.status !== "review" || row.seller_id === viewerId;
}

function totalRequired(row: ListingRow): number {
  return row.sale_price + row.premium + row.option_cost;
}

function messagePreview(row: TradeMessageRow): string {
  if (row.kind === "offer" && row.offer_amount !== null) return `가격 제안 ${formatWon(row.offer_amount)}`;
  return row.body.length > 60 ? `${row.body.slice(0, 60)}…` : row.body;
}

function toChatMessage(row: TradeMessageRow): ChatMessage {
  if (row.kind === "offer" && row.author_role && row.offer_amount !== null && row.offer_status) {
    return {
      id: row.id, roomId: row.chat_id, kind: "offer", senderRole: row.author_role,
      amount: row.offer_amount, baseAmount: row.offer_base_amount ?? row.offer_amount,
      status: row.offer_status, respondedAt: row.responded_at, createdAt: row.created_at,
    };
  }
  if (row.kind === "system" || row.author_role === null) {
    return { id: row.id, roomId: row.chat_id, kind: "system", senderRole: "system", text: row.body, createdAt: row.created_at };
  }
  return { id: row.id, roomId: row.chat_id, kind: "text", senderRole: row.author_role, text: row.body, createdAt: row.created_at };
}

function roleOf(chat: TradeChatRow, userId: number): ChatRole | null {
  if (chat.buyer_id === userId) return "buyer";
  if (chat.seller_id === userId) return "seller";
  return null;
}

async function toChatRoom(tx: StoreTx, chat: TradeChatRow, userId: number): Promise<ChatRoom> {
  const role = roleOf(chat, userId);
  if (!role) throw forbidden("이 대화방의 당사자가 아니에요");
  const otherId = role === "buyer" ? chat.seller_id : chat.buyer_id;
  const other = await tx.findUserById(otherId);
  const listing = await tx.findListing(chat.listing_id);
  const last = await tx.lastMessage(chat.id);
  const read = await tx.findRead(chat.id, userId);
  const unread = await tx.countMessagesAfter(chat.id, read?.last_read_message_id ?? 0, role === "buyer" ? "seller" : "buyer");
  return {
    id: chat.id,
    listingId: chat.listing_id,
    listingTitle: listing?.title ?? "삭제된 매물",
    myRole: role,
    counterpart: { id: otherId, nickname: other?.nickname ?? "알 수 없음" },
    status: chat.deal_status,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
    lastMessage: last ? { preview: messagePreview(last), at: last.created_at, senderRole: last.author_role ?? "system" } : null,
    unread,
  };
}

// ---------- 인증 ----------

export async function signup(store: Store, input: unknown): Promise<{ user: AuthUser; token: string }> {
  const body = requireRecord(input);
  const email = stringField(body, "email", { max: 254 }).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const nickname = stringField(body, "nickname", { min: 2, max: 12 });
  if (!EMAIL_PATTERN.test(email)) throw badRequest("이메일 형식이 올바르지 않아요");
  if (password.length < 8 || password.length > 128) throw badRequest("비밀번호는 8~128자로 정해주세요");
  const passwordHash = await hashPassword(password); // 느린 계산은 잠금 밖에서
  return store.write(async (tx) => {
    if (await tx.findUserByEmail(email)) throw conflict("이미 가입한 이메일이에요");
    const now = new Date().toISOString();
    const user = await tx.insertUser({ nickname, real_name: null, identity_verified: false, membership: "free", email, password_hash: passwordHash, created_at: now });
    const token = await createSession(tx, user.id);
    return { user: toAuthUser(user), token };
  });
}

async function createSession(tx: StoreTx, userId: number): Promise<string> {
  const token = newSessionToken();
  const now = new Date();
  await tx.deleteExpiredSessions(now.toISOString());
  await tx.insertSession({
    token_hash: hashToken(token),
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
  });
  return token;
}

export async function login(store: Store, input: unknown): Promise<{ user: AuthUser; token: string }> {
  const body = requireRecord(input);
  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const user = await store.read((tx) => tx.findUserByEmail(email));
  // 이메일이 없을 때도 같은 메시지(가입 여부를 알려주지 않는다)
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new ApiError(401, "invalid_credentials", "이메일 또는 비밀번호가 맞지 않아요");
  }
  const token = await store.write((tx) => createSession(tx, user.id));
  return { user: toAuthUser(user), token };
}

export async function logout(store: Store, token: string | undefined): Promise<void> {
  if (!token) return;
  await store.write((tx) => tx.deleteSession(hashToken(token)));
}

/** 세션 쿠키로 사용자를 찾는다. 없거나 만료면 null */
export async function userFromToken(store: Store, token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  return store.read(async (tx) => {
    const session = await tx.findSession(hashToken(token));
    if (!session || session.expires_at <= new Date().toISOString()) return null;
    return tx.findUserById(session.user_id);
  });
}

// ---------- 단지·매물 ----------

export async function listComplexes(store: Store): Promise<Complex[]> {
  return store.read(async (tx) => {
    const [rows, districts, areas] = await Promise.all([tx.listComplexes(), tx.listDistricts(), tx.listComplexAreas()]);
    return rows.map((row) => toComplex(row, districts.find((d) => d.id === row.district_id), areas)).filter((c): c is Complex => c !== null);
  });
}

export async function listListings(store: Store, viewerId: number | null): Promise<PresaleListing[]> {
  return store.read(async (tx) => {
    const rows = (await tx.listTradeListings()).filter((row) => isVisible(row, viewerId)).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    const ctx = await listingContext(tx, rows, viewerId);
    return rows.map((row) => toPresaleListing(row, ctx));
  });
}

export async function getListing(store: Store, viewerId: number | null, listingId: number): Promise<PresaleListing> {
  return store.read(async (tx) => {
    const row = await tx.findListing(listingId);
    if (!row || !isVisible(row, viewerId)) throw notFound("매물");
    return toPresaleListing(row, await listingContext(tx, [row], viewerId));
  });
}

export async function createListing(store: Store, sellerId: number, input: unknown): Promise<PresaleListing> {
  const body = requireRecord(input);
  const complexId = stringField(body, "complexId", { min: 1, max: 64 });
  const area = body.area;
  if (typeof area !== "number" || !(area > 0) || area > 1000) throw badRequest("area는 0보다 큰 숫자여야 해요");
  const floor = intField(body, "floor", { min: 1, max: 99 }) as number;
  const salePrice = intField(body, "salePrice", { min: 1, max: MAX_WON }) as number;
  const premium = intField(body, "premium", { min: 0, max: MAX_WON }) as number;
  const optionCost = intField(body, "optionCost", { min: 0, max: MAX_WON }) as number;
  const paidAmount = intField(body, "paidAmount", { min: 0, max: MAX_WON }) as number;
  if (paidAmount > salePrice + optionCost) throw badRequest("낸 금액이 분양가와 옵션비를 더한 금액보다 클 수 없어요");
  const description = stringField(body, "description", { min: 10, max: 1000 });
  const documents = Array.isArray(body.documents) ? body.documents : [];
  const docs: { kind: TradeDocumentKind; status: (typeof DOCUMENT_STATUSES)[number] }[] = [];
  for (const doc of documents) {
    if (!isRecord(doc) || !DOCUMENT_KINDS.includes(doc.type as TradeDocumentKind) || !DOCUMENT_STATUSES.includes(doc.status as (typeof DOCUMENT_STATUSES)[number])) {
      throw badRequest("documents 형식이 올바르지 않아요");
    }
    docs.push({ kind: doc.type as TradeDocumentKind, status: doc.status as (typeof DOCUMENT_STATUSES)[number] });
  }
  const trust = body.trust === undefined ? null : body.trust;
  if (trust !== null && !isTrustReport(trust)) throw badRequest("trust 형식이 올바르지 않아요");
  if (trust && (trust.score < 0 || trust.score > 100)) throw badRequest("trust.score는 0~100이어야 해요");

  const created = await store.write(async (tx) => {
    const complexRow = await tx.findComplex(complexId);
    if (!complexRow) throw badRequest("단지 정보를 찾을 수 없어요");
    const complex = toComplex(complexRow, (await tx.listDistricts()).find((d) => d.id === complexRow.district_id), await tx.listComplexAreas());
    if (complex && isResaleRestricted(complex)) throw conflict("전매제한 기간이라 아직 등록할 수 없어요");
    const now = new Date().toISOString();
    const row = await tx.insertListing({
      type: "trade",
      complex_id: complexId,
      title: `${complexRow.name} ${area}㎡`,
      description,
      created_at: now,
      urgent: false,
      seller_id: sellerId,
      // 신뢰 점수가 기준 미만이면 검토 대기로 두고 공개 목록에 노출하지 않는다
      status: trust && trust.score < REVIEW_THRESHOLD_SCORE ? "review" : "selling",
      area_m2: area,
      floor,
      sale_price: salePrice,
      premium,
      option_cost: optionCost,
      paid_amount: paidAmount,
    });
    for (const doc of docs) await tx.upsertTradeDocument({ listing_id: row.id, kind: doc.kind, status: doc.status, storage_key: null });
    if (trust) await tx.insertTrustReport({ listing_id: row.id, evaluated_at: trust.evaluatedAt, score: trust.score, mode: trust.mode, report_json: trust });
    return row;
  });
  return getListing(store, sellerId, created.id);
}

/** 판매자 본인만 설명·상태를 바꿀 수 있다 */
export async function updateListing(store: Store, userId: number, listingId: number, input: unknown): Promise<PresaleListing> {
  const body = requireRecord(input);
  const patch: { description?: string; status?: "selling" | "reserved" | "sold" } = {};
  if (body.description !== undefined) patch.description = stringField(body, "description", { min: 10, max: 1000 });
  if (body.status !== undefined) {
    if (body.status !== "selling" && body.status !== "reserved" && body.status !== "sold") throw badRequest("status는 selling/reserved/sold 중 하나예요");
    patch.status = body.status;
  }
  if (Object.keys(patch).length === 0) throw badRequest("바꿀 값이 없어요");
  await store.write(async (tx) => {
    const row = await tx.findListing(listingId);
    if (!row || !isVisible(row, userId)) throw notFound("매물");
    if (row.seller_id !== userId) throw forbidden("내 매물만 수정할 수 있어요");
    if (row.status === "review" && patch.status) throw conflict("검토 중인 매물은 상태를 바꿀 수 없어요");
    await tx.updateListing(listingId, patch);
  });
  return getListing(store, userId, listingId);
}

export async function setFavorite(store: Store, userId: number, listingId: number, input: unknown): Promise<{ liked: boolean }> {
  const body = requireRecord(input);
  if (typeof body.liked !== "boolean") throw badRequest("liked는 true 또는 false예요");
  const liked = body.liked;
  await store.write(async (tx) => {
    const row = await tx.findListing(listingId);
    if (!row || !isVisible(row, userId)) throw notFound("매물");
    if (liked) await tx.addFavorite({ user_id: userId, listing_id: listingId });
    else await tx.removeFavorite({ user_id: userId, listing_id: listingId });
  });
  return { liked };
}

// ---------- 채팅 ----------

/** 당사자가 아니면 403, 없으면 404 */
async function requireParticipant(tx: StoreTx, chatId: number, userId: number): Promise<{ chat: TradeChatRow; role: ChatRole }> {
  const chat = await tx.findChat(chatId);
  if (!chat) throw notFound("대화방");
  const role = roleOf(chat, userId);
  if (!role) throw forbidden("이 대화방의 당사자가 아니에요");
  return { chat, role };
}

export async function listChats(store: Store, userId: number): Promise<ChatRoom[]> {
  return store.read(async (tx) => {
    const chats = await tx.listChatsForUser(userId);
    const rooms = await Promise.all(chats.map((chat) => toChatRoom(tx, chat, userId)));
    return rooms.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });
}

export async function getChat(store: Store, userId: number, chatId: number): Promise<ChatRoom> {
  return store.read(async (tx) => {
    const { chat } = await requireParticipant(tx, chatId, userId);
    return toChatRoom(tx, chat, userId);
  });
}

/** 매물로 방 열기: 같은 매물·같은 구매자면 기존 방. 자기 매물이면 거부 */
export async function openChat(store: Store, userId: number, input: unknown): Promise<{ room: ChatRoom; created: boolean }> {
  const listingId = intField(requireRecord(input), "listingId", { min: 1 }) as number;
  return store.write(async (tx) => {
    const listing = await tx.findListing(listingId);
    if (!listing || !isVisible(listing, userId)) throw notFound("매물");
    if (listing.seller_id === userId) throw conflict("내 매물에는 문의할 수 없어요");
    const existing = await tx.findChatByListingAndBuyer(listingId, userId);
    if (existing) return { room: await toChatRoom(tx, existing, userId), created: false };
    if (listing.status === "review" || listing.status === "sold") throw conflict("지금은 문의할 수 없는 매물이에요");
    const now = new Date().toISOString();
    const chat = await tx.insertChat({ listing_id: listingId, seller_id: listing.seller_id, buyer_id: userId, status: "open", deal_status: "inquiry", created_at: now, updated_at: now });
    return { room: await toChatRoom(tx, chat, userId), created: true };
  });
}

export async function listMessages(store: Store, userId: number, chatId: number): Promise<ChatMessage[]> {
  return store.read(async (tx) => {
    await requireParticipant(tx, chatId, userId);
    return (await tx.listMessages(chatId)).map(toChatMessage);
  });
}

async function appendMessage(tx: StoreTx, chat: TradeChatRow, row: Omit<TradeMessageRow, "id" | "chat_id" | "created_at">, readerId: number | null): Promise<TradeMessageRow> {
  const now = new Date().toISOString();
  const message = await tx.insertMessage({ ...row, chat_id: chat.id, created_at: now });
  await tx.updateChat(chat.id, { updated_at: now });
  // 보낸 사람은 자기 메시지까지 읽은 것으로 본다
  if (readerId !== null) await tx.upsertRead({ chat_id: chat.id, user_id: readerId, last_read_message_id: message.id });
  return message;
}

const NO_OFFER = { offer_amount: null, offer_base_amount: null, offer_status: null, responded_at: null } as const;

export type ChatChange = { chat: TradeChatRow; message?: ChatMessage };

export async function sendText(store: Store, userId: number, chatId: number, input: unknown): Promise<ChatChange> {
  const text = stringField(requireRecord(input), "text", { min: 1, max: MAX_TEXT_LENGTH });
  return store.write(async (tx) => {
    const { chat, role } = await requireParticipant(tx, chatId, userId);
    if (chat.deal_status === "done") throw conflict("거래가 끝난 대화방이에요");
    const message = await appendMessage(tx, chat, { author_role: role, body: text, kind: "text", ...NO_OFFER }, userId);
    return { chat, message: toChatMessage(message) };
  });
}

/** 가격 제안: 구매자만 보낼 수 있다 */
export async function sendOffer(store: Store, userId: number, chatId: number, input: unknown): Promise<ChatChange> {
  const amount = intField(requireRecord(input), "amount", { min: 1, max: MAX_WON }) as number;
  return store.write(async (tx) => {
    const { chat, role } = await requireParticipant(tx, chatId, userId);
    if (role !== "buyer") throw forbidden("가격 제안은 구매자만 보낼 수 있어요");
    if (chat.deal_status === "contracting" || chat.deal_status === "done") throw conflict("이미 계약을 진행 중인 대화방이에요");
    const listing = await tx.findListing(chat.listing_id);
    if (!listing) throw notFound("매물");
    await tx.supersedePendingOffers(chat.id);
    const message = await appendMessage(tx, chat, {
      author_role: "buyer",
      body: `가격 제안 ${formatWon(amount)}`,
      kind: "offer",
      offer_amount: amount,
      offer_base_amount: totalRequired(listing),
      offer_status: "pending",
      responded_at: null,
    }, userId);
    const updated = await tx.updateChat(chat.id, { deal_status: "negotiating" });
    return { chat: updated, message: toChatMessage(message) };
  });
}

/** 가격 제안 수락·거절: 판매자만. 수락하면 계약진행 */
export async function respondOffer(store: Store, userId: number, chatId: number, messageId: number, accept: boolean): Promise<ChatChange> {
  return store.write(async (tx) => {
    const { chat, role } = await requireParticipant(tx, chatId, userId);
    if (role !== "seller") throw forbidden("가격 제안에는 판매자만 답할 수 있어요");
    const offer = await tx.findMessage(messageId);
    if (!offer || offer.chat_id !== chatId || offer.kind !== "offer") throw notFound("가격 제안");
    if (offer.offer_status !== "pending") throw conflict("이미 답한 제안이에요");
    const now = new Date().toISOString();
    await tx.updateMessage(messageId, { offer_status: accept ? "accepted" : "rejected", responded_at: now });
    const amount = formatWon(offer.offer_amount ?? 0);
    const message = await appendMessage(tx, chat, {
      author_role: null,
      body: accept ? `판매자가 ${amount} 제안을 수락했어요. 계약을 진행해요` : `판매자가 ${amount} 제안을 거절했어요`,
      kind: "system",
      ...NO_OFFER,
    }, null);
    const updated = accept ? await tx.updateChat(chat.id, { deal_status: "contracting" }) : chat;
    return { chat: updated, message: toChatMessage(message) };
  });
}

/** 거래 완료: 판매자만, 계약진행 상태에서만 */
export async function completeChat(store: Store, userId: number, chatId: number): Promise<ChatChange> {
  return store.write(async (tx) => {
    const { chat, role } = await requireParticipant(tx, chatId, userId);
    if (role !== "seller") throw forbidden("거래 완료는 판매자만 표시할 수 있어요");
    if (chat.deal_status !== "contracting") throw conflict("계약을 진행 중일 때만 완료할 수 있어요");
    const message = await appendMessage(tx, chat, { author_role: null, body: "판매자가 거래를 완료로 표시했어요", kind: "system", ...NO_OFFER }, null);
    const updated = await tx.updateChat(chat.id, { deal_status: "done", status: "closed" });
    return { chat: updated, message: toChatMessage(message) };
  });
}

export async function markRead(store: Store, userId: number, chatId: number): Promise<ChatChange> {
  return store.write(async (tx) => {
    const { chat } = await requireParticipant(tx, chatId, userId);
    const last = await tx.lastMessage(chatId);
    if (last) await tx.upsertRead({ chat_id: chatId, user_id: userId, last_read_message_id: last.id });
    return { chat };
  });
}

export function requireUser(user: UserRow | null): UserRow {
  if (!user) throw unauthorized();
  return user;
}
