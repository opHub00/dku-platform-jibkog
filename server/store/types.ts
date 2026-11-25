/**
 * 서버 저장 계층의 행(row) 타입과 저장소 인터페이스.
 *
 * 테이블·필드 이름은 db/migrations/001_initial.sql(origin/feature/database)을 그대로 따른다.
 * "(추가)"라고 표시한 필드·테이블은 001에 없어서 이 서버가 새로 쓰는 것이다(docs/db-requests.md 참고).
 * 금액은 원 단위 정수, 시각은 ISO 문자열(DB에서는 TIMESTAMPTZ).
 */

export type UserRow = {
  id: number;
  nickname: string;
  real_name: string | null;
  identity_verified: boolean;
  membership: string;
  /** (추가) 로그인 이메일. 소문자로 저장, 중복 불가 */
  email: string;
  /** (추가) scrypt 해시 문자열. 평문 비밀번호는 저장하지 않는다 */
  password_hash: string;
  /** (추가) */
  created_at: string;
};

/** (추가 테이블) 로그인 세션. 토큰 원문이 아니라 SHA-256 해시만 저장한다 */
export type SessionRow = {
  token_hash: string;
  user_id: number;
  created_at: string;
  expires_at: string;
};

export type DistrictRow = { id: string; sido: string; sigungu: string };

export type ComplexRow = {
  id: string;
  district_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  move_in_month: string | null;
  resale_restriction_ends_on: string | null;
  reference_premium_rate: number | null;
  image: string | null;
};

export type ComplexAreaRow = { complex_id: string; area_m2: number };

export type ListingStatus = "selling" | "reserved" | "sold" | "review";

/** listings 중 분양권 거래(type='trade') 행. 청약공고(notice) 필드는 이 서버에서 쓰지 않는다 */
export type ListingRow = {
  id: number;
  type: "trade";
  complex_id: string;
  title: string;
  description: string;
  created_at: string;
  urgent: boolean;
  seller_id: number;
  status: ListingStatus;
  area_m2: number;
  floor: number | null;
  sale_price: number;
  premium: number;
  option_cost: number;
  paid_amount: number;
  catalog_complex_id?: string | null;
  housing_model_number?: string | null;
  is_demo?: boolean;
};

export type TradeDocumentKind = "salesContract" | "paymentProof" | "optionContract";

export type TradeDocumentRow = {
  listing_id: number;
  kind: TradeDocumentKind;
  status: "verified" | "pending" | "missing";
  storage_key: string | null;
};

export type TrustReportRow = {
  id: number;
  listing_id: number;
  evaluated_at: string;
  score: number;
  mode: "demo" | "live";
  /** 화면용 신뢰 리포트 전체(JSON) */
  report_json: unknown;
};

export type FavoriteRow = { user_id: number; listing_id: number };

/** (추가) 거래 단계. 001의 status(open/closed)와 별도로 둔다 */
export type DealStatus = "inquiry" | "negotiating" | "contracting" | "done";

export type TradeChatRow = {
  id: number;
  listing_id: number;
  seller_id: number;
  buyer_id: number;
  /** 001 그대로: 거래 완료 시 'closed' */
  status: "open" | "closed";
  /** (추가) */
  deal_status: DealStatus;
  /** (추가) */
  created_at: string;
  /** (추가) 목록 정렬용: 마지막 메시지 시각 */
  updated_at: string;
};

export type MessageKind = "text" | "offer" | "system";
export type OfferStatus = "pending" | "accepted" | "rejected" | "superseded";

export type TradeMessageRow = {
  id: number;
  chat_id: number;
  /** 001은 buyer/seller만 허용. 시스템 안내는 null (추가: NULL 허용) */
  author_role: "buyer" | "seller" | null;
  body: string;
  created_at: string;
  /** (추가) */
  kind: MessageKind;
  /** (추가) 가격 제안 금액(총 매수가, 원) */
  offer_amount: number | null;
  /** (추가) 제안 당시 총 필요자금(원) */
  offer_base_amount: number | null;
  /** (추가) */
  offer_status: OfferStatus | null;
  /** (추가) */
  responded_at: string | null;
};

/** (추가 테이블) 사용자별 마지막으로 읽은 메시지 */
export type TradeChatReadRow = {
  chat_id: number;
  user_id: number;
  last_read_message_id: number;
};

/**
 * 테이블 단위 저장 함수. DB로 바꿀 때는 이 함수들을 SQL로 구현한다.
 * 권한 검사는 여기서 하지 않는다(서비스 계층 server/api/services.ts가 한다).
 */
export interface StoreTx {
  // users
  insertUser(row: Omit<UserRow, "id">): Promise<UserRow>;
  findUserById(id: number): Promise<UserRow | null>;
  findUserByEmail(email: string): Promise<UserRow | null>;
  updateUser(id: number, patch: Partial<Pick<UserRow, "identity_verified">>): Promise<UserRow>;
  // sessions
  insertSession(row: SessionRow): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRow | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(nowIso: string): Promise<void>;
  // districts / complexes
  listDistricts(): Promise<DistrictRow[]>;
  listComplexes(): Promise<ComplexRow[]>;
  listComplexAreas(): Promise<ComplexAreaRow[]>;
  findComplex(id: string): Promise<ComplexRow | null>;
  upsertDistrict(row: DistrictRow): Promise<void>;
  upsertComplex(row: ComplexRow): Promise<void>;
  upsertComplexArea(row: ComplexAreaRow): Promise<void>;
  // listings
  listTradeListings(): Promise<ListingRow[]>;
  findListing(id: number): Promise<ListingRow | null>;
  insertListing(row: Omit<ListingRow, "id">): Promise<ListingRow>;
  updateListing(id: number, patch: Partial<Pick<ListingRow, "description" | "status" | "premium" | "urgent">>): Promise<ListingRow>;
  listTradeDocuments(listingIds: number[]): Promise<TradeDocumentRow[]>;
  upsertTradeDocument(row: TradeDocumentRow): Promise<void>;
  insertTrustReport(row: Omit<TrustReportRow, "id">): Promise<TrustReportRow>;
  /** 매물마다 가장 최근 리포트 하나 */
  latestTrustReports(listingIds: number[]): Promise<TrustReportRow[]>;
  // favorites
  listFavoriteListingIds(userId: number): Promise<number[]>;
  addFavorite(row: FavoriteRow): Promise<void>;
  removeFavorite(row: FavoriteRow): Promise<void>;
  // trade chats
  listChatsForUser(userId: number): Promise<TradeChatRow[]>;
  findChat(id: number): Promise<TradeChatRow | null>;
  findChatByListingAndBuyer(listingId: number, buyerId: number): Promise<TradeChatRow | null>;
  insertChat(row: Omit<TradeChatRow, "id">): Promise<TradeChatRow>;
  updateChat(id: number, patch: Partial<Pick<TradeChatRow, "status" | "deal_status" | "updated_at">>): Promise<TradeChatRow>;
  countCompletedTradesBySeller(sellerId: number): Promise<number>;
  // trade messages
  listMessages(chatId: number): Promise<TradeMessageRow[]>;
  findMessage(id: number): Promise<TradeMessageRow | null>;
  lastMessage(chatId: number): Promise<TradeMessageRow | null>;
  insertMessage(row: Omit<TradeMessageRow, "id">): Promise<TradeMessageRow>;
  updateMessage(id: number, patch: Partial<Pick<TradeMessageRow, "offer_status" | "responded_at">>): Promise<TradeMessageRow>;
  /** 이 방의 답변 대기 제안을 모두 superseded로 바꾼다 */
  supersedePendingOffers(chatId: number): Promise<void>;
  /** afterMessageId보다 뒤에 온, authorRole이 보낸 메시지 수(안 읽은 수) */
  countMessagesAfter(chatId: number, afterMessageId: number, authorRole: "buyer" | "seller"): Promise<number>;
  // reads
  findRead(chatId: number, userId: number): Promise<TradeChatReadRow | null>;
  upsertRead(row: TradeChatReadRow): Promise<void>;
}

/**
 * 저장소. 읽기는 read, 쓰기는 write 안에서 한다.
 * write는 하나의 트랜잭션: 안에서 오류가 나면 전부 되돌린다. 동시에 들어온 write는 순서대로 실행된다.
 * DB 구현체에서는 write = BEGIN ... COMMIT(오류 시 ROLLBACK).
 */
export interface Store {
  read<T>(work: (tx: StoreTx) => Promise<T>): Promise<T>;
  write<T>(work: (tx: StoreTx) => Promise<T>): Promise<T>;
}
