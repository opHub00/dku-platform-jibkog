import { createRequire } from "node:module";
import path from "node:path";
import type { Tables } from "./jsonFileStore";
import type {
  UserRow, SessionRow, DistrictRow, ComplexRow, ComplexAreaRow, ListingRow,
  TradeDocumentRow, TrustReportRow, TradeChatRow, TradeMessageRow, TradeChatReadRow, Store, StoreTx,
} from "./types";

type Row = Record<string, unknown>;
type Client = {
  query(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
  release(): void;
};
type Pool = { connect(): Promise<Client>; end(): Promise<void>; on(event: "error", listener: (error: Error) => void): void };

const moneyFields = ["sale_price", "premium", "option_cost", "paid_amount", "offer_amount", "offer_base_amount"];
function normalize<T>(row: Row): T {
  const result = { ...row };
  for (const key of moneyFields) {
    if (typeof result[key] === "string") {
      const value = Number(result[key]);
      if (!Number.isSafeInteger(value)) throw new Error("Unsafe integer from PostgreSQL: " + key);
      result[key] = value;
    }
  }
  for (const [key, value] of Object.entries(result)) {
    if (value instanceof Date) result[key] = value.toISOString();
  }
  return result as T;
}

function createTx(client: Client): StoreTx {
  const many = async <T>(sql: string, values: unknown[] = []): Promise<T[]> =>
    (await client.query(sql, values)).rows.map(row => normalize<T>(row));
  const one = async <T>(sql: string, values: unknown[] = []): Promise<T | null> =>
    (await many<T>(sql, values))[0] ?? null;
  const required = async <T>(sql: string, values: unknown[] = []): Promise<T> => {
    const row = await one<T>(sql, values);
    if (!row) throw new Error("Row not found");
    return row;
  };
  // Table and column identifiers below are fixed by the StoreTx contract, never request input.
  const insert = <T>(table: string, row: object, columns: string[]): Promise<T> => {
    const values = row as Row;
    return required<T>("INSERT INTO " + table + " (" + columns.join(",") + ") VALUES (" +
      columns.map((_, i) => "$" + (i + 1)).join(",") + ") RETURNING *",
      columns.map(key => key === "report_json" ? JSON.stringify(values[key]) : values[key]));
  };
  const update = <T>(table: string, id: number, patch: object, allowed: string[], predicate = ""): Promise<T> => {
    const values = patch as Row;
    const keys = allowed.filter(key => values[key] !== undefined);
    if (!keys.length) return required<T>("SELECT * FROM " + table + " WHERE id=$1" + predicate, [id]);
    return required<T>("UPDATE " + table + " SET " + keys.map((key, i) => key + "=$" + (i + 2)).join(",") +
      " WHERE id=$1" + predicate + " RETURNING *", [id, ...keys.map(key => values[key])]);
  };
  const exec = async (sql: string, values: unknown[]) => { await client.query(sql, values); };
  const count = async (sql: string, values: unknown[]) => Number((await required<{ count: string }>(sql, values)).count);
  const complexSelect = "SELECT *, resale_restriction_ends_on::text AS resale_restriction_ends_on FROM complexes";

  return {
    insertUser: row => insert<UserRow>("users", row, ["nickname","real_name","identity_verified","membership","email","password_hash","created_at"]),
    findUserById: id => one<UserRow>("SELECT * FROM users WHERE id=$1", [id]),
    findUserByEmail: email => one<UserRow>("SELECT * FROM users WHERE email=$1", [email]),
    updateUser: (id, patch) => update<UserRow>("users", id, patch, ["identity_verified"]),
    insertSession: row => exec("INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES ($1,$2,$3,$4)", [row.token_hash,row.user_id,row.created_at,row.expires_at]),
    findSession: token => one<SessionRow>("SELECT * FROM sessions WHERE token_hash=$1", [token]),
    deleteSession: token => exec("DELETE FROM sessions WHERE token_hash=$1", [token]),
    deleteExpiredSessions: now => exec("DELETE FROM sessions WHERE expires_at <= $1", [now]),
    listDistricts: () => many<DistrictRow>("SELECT * FROM districts ORDER BY id"),
    listComplexes: () => many<ComplexRow>(complexSelect + " ORDER BY id"),
    listComplexAreas: () => many<ComplexAreaRow>("SELECT * FROM complex_areas ORDER BY complex_id,area_m2"),
    findComplex: id => one<ComplexRow>(complexSelect + " WHERE id=$1", [id]),
    // 청약 카탈로그 단지(예시 매물·카탈로그 등록)용. 005_catalog_listings.sql
    upsertDistrict: row => exec("INSERT INTO districts(id,sido,sigungu) VALUES ($1,$2,$3) ON CONFLICT(id) DO NOTHING", [row.id,row.sido,row.sigungu]),
    upsertComplex: row => exec("INSERT INTO complexes(id,district_id,name,address,latitude,longitude,move_in_month,resale_restriction_ends_on,reference_premium_rate,image) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET district_id=EXCLUDED.district_id,name=EXCLUDED.name,address=EXCLUDED.address,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,move_in_month=EXCLUDED.move_in_month,resale_restriction_ends_on=EXCLUDED.resale_restriction_ends_on,reference_premium_rate=EXCLUDED.reference_premium_rate,image=EXCLUDED.image",
      [row.id,row.district_id,row.name,row.address,row.latitude,row.longitude,row.move_in_month,row.resale_restriction_ends_on,row.reference_premium_rate,row.image]),
    upsertComplexArea: row => exec("INSERT INTO complex_areas(complex_id,area_m2) VALUES ($1,$2) ON CONFLICT DO NOTHING", [row.complex_id,row.area_m2]),
    listTradeListings: () => many<ListingRow>("SELECT * FROM listings WHERE type='trade'"),
    findListing: id => one<ListingRow>("SELECT * FROM listings WHERE id=$1 AND type='trade'", [id]),
    // 카탈로그 필드는 없으면 NULL, is_demo는 없으면 FALSE(005_catalog_listings.sql)
    insertListing: row => insert<ListingRow>("listings", { ...row, catalog_complex_id: row.catalog_complex_id ?? null, housing_model_number: row.housing_model_number ?? null, is_demo: row.is_demo ?? false },
      ["type","complex_id","title","description","created_at","urgent","seller_id","status","area_m2","floor","sale_price","premium","option_cost","paid_amount","catalog_complex_id","housing_model_number","is_demo"]),
    updateListing: (id, patch) => update<ListingRow>("listings", id, patch, ["description","status","premium","urgent"], " AND type='trade'"),
    listTradeDocuments: ids => many<TradeDocumentRow>("SELECT * FROM trade_documents WHERE listing_id=ANY($1::integer[])", [ids]),
    upsertTradeDocument: row => exec("INSERT INTO trade_documents(listing_id,kind,status,storage_key) VALUES ($1,$2,$3,$4) ON CONFLICT(listing_id,kind) DO UPDATE SET status=EXCLUDED.status,storage_key=EXCLUDED.storage_key", [row.listing_id,row.kind,row.status,row.storage_key]),
    insertTrustReport: row => insert<TrustReportRow>("trust_reports", row, ["listing_id","evaluated_at","score","mode","report_json"]),
    latestTrustReports: ids => many<TrustReportRow>("SELECT DISTINCT ON(listing_id) * FROM trust_reports WHERE listing_id=ANY($1::integer[]) ORDER BY listing_id,evaluated_at DESC,id DESC", [ids]),
    async listFavoriteListingIds(userId) {
      return (await many<{ listing_id: number }>("SELECT listing_id FROM favorites WHERE user_id=$1", [userId])).map(row => row.listing_id);
    },
    addFavorite: row => exec("INSERT INTO favorites(user_id,listing_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [row.user_id,row.listing_id]),
    removeFavorite: row => exec("DELETE FROM favorites WHERE user_id=$1 AND listing_id=$2", [row.user_id,row.listing_id]),
    listChatsForUser: id => many<TradeChatRow>("SELECT * FROM trade_chats WHERE buyer_id=$1 OR seller_id=$1 ORDER BY updated_at DESC,id DESC", [id]),
    findChat: id => one<TradeChatRow>("SELECT * FROM trade_chats WHERE id=$1", [id]),
    findChatByListingAndBuyer: (listing,buyer) => one<TradeChatRow>("SELECT * FROM trade_chats WHERE listing_id=$1 AND buyer_id=$2", [listing,buyer]),
    insertChat: row => insert<TradeChatRow>("trade_chats", row, ["listing_id","seller_id","buyer_id","status","deal_status","created_at","updated_at"]),
    updateChat: (id,patch) => update<TradeChatRow>("trade_chats", id, patch, ["status","deal_status","updated_at"]),
    countCompletedTradesBySeller: id => count("SELECT count(*) FROM trade_chats WHERE seller_id=$1 AND deal_status='done'", [id]),
    listMessages: id => many<TradeMessageRow>("SELECT * FROM trade_messages WHERE chat_id=$1 ORDER BY id", [id]),
    findMessage: id => one<TradeMessageRow>("SELECT * FROM trade_messages WHERE id=$1", [id]),
    lastMessage: id => one<TradeMessageRow>("SELECT * FROM trade_messages WHERE chat_id=$1 ORDER BY id DESC LIMIT 1", [id]),
    insertMessage: row => insert<TradeMessageRow>("trade_messages", row, ["chat_id","author_role","body","created_at","kind","offer_amount","offer_base_amount","offer_status","responded_at"]),
    updateMessage: (id,patch) => update<TradeMessageRow>("trade_messages", id, patch, ["offer_status","responded_at"]),
    supersedePendingOffers: id => exec("UPDATE trade_messages SET offer_status='superseded' WHERE chat_id=$1 AND offer_status='pending'", [id]),
    countMessagesAfter: (id,after,role) => count("SELECT count(*) FROM trade_messages WHERE chat_id=$1 AND id>$2 AND author_role=$3", [id,after,role]),
    findRead: (chat,user) => one<TradeChatReadRow>("SELECT * FROM trade_chat_reads WHERE chat_id=$1 AND user_id=$2", [chat,user]),
    upsertRead: row => exec("INSERT INTO trade_chat_reads(chat_id,user_id,last_read_message_id) VALUES ($1,$2,$3) ON CONFLICT(chat_id,user_id) DO UPDATE SET last_read_message_id=GREATEST(trade_chat_reads.last_read_message_id,EXCLUDED.last_read_message_id)", [row.chat_id,row.user_id,row.last_read_message_id]),
  };
}

// Only explicit development seeding is allowed; never overwrite an existing dataset.
async function seedDemo(client: Client, buildSeed: () => Tables) {
  await client.query("CREATE TABLE IF NOT EXISTS dev_seeds (name TEXT PRIMARY KEY)");
  if ((await client.query("SELECT 1 FROM dev_seeds WHERE name='app-demo-v1'")).rows.length) return;
  const tables = buildSeed();
  const order = ["users","districts","complexes","complex_areas","listings","trade_documents","trust_reports","favorites","trade_chats","trade_messages","trade_chat_reads","sessions"] as const;
  for (const name of order) {
    await client.query("LOCK TABLE " + name + " IN SHARE ROW EXCLUSIVE MODE");
    if ((await client.query("SELECT 1 FROM " + name + " LIMIT 1")).rows.length) {
      throw new Error("App demo seed requires an empty database; use a separate database");
    }
  }
  for (const name of order) {
    for (const raw of tables[name]) {
      const row = raw as unknown as Row;
      const keys = Object.keys(row);
      await client.query("INSERT INTO " + name + " (" + keys.join(",") + ") VALUES (" + keys.map((_, i) => "$" + (i + 1)).join(",") + ")",
        keys.map(key => key === "report_json" ? JSON.stringify(row[key]) : row[key]));
    }
  }
  for (const name of ["users","listings","trust_reports","trade_chats","trade_messages"]) {
    await client.query("SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM " + name, [name]);
  }
  await client.query("INSERT INTO dev_seeds VALUES ('app-demo-v1')");
}

export function createPostgresStore(options: { databaseUrl: string; dbDir: string; seed?: () => Tables; log?: (message: string) => void }): Store & { close(): Promise<void> } {
  // Reuse the existing pg dependency installed in db/, including when Vite bundles its config.
  const require = createRequire(path.resolve(options.dbDir, "package.json"));
  const { Pool } = require("pg") as { Pool: new (config: { connectionString: string }) => Pool };
  const pool = new Pool({ connectionString: options.databaseUrl });
  pool.on("error", error => options.log?.("PostgreSQL idle connection: " + error.message));
  async function transaction<T>(write: boolean, work: (tx: StoreTx) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query(write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      // Preserve the JSON store's serialized write semantics across all server instances.
      if (write) await client.query("SELECT pg_advisory_xact_lock(hashtext('jibkog.store.write'))");
      const result = await work(createTx(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  let initialization: Promise<void> | undefined;
  function initialize(): Promise<void> {
    if (!options.seed) return Promise.resolve();
    if (!initialization) {
      const seed = options.seed;
      initialization = (async () => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(hashtext('jibkog.db.migrations'))");
          await client.query("SELECT pg_advisory_xact_lock(hashtext('jibkog.store.write'))");
          await seedDemo(client, seed);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      })().catch(error => { initialization = undefined; throw error; });
    }
    return initialization;
  }
  return {
    async read(work) { await initialize(); return transaction(false, work); },
    async write(work) { await initialize(); return transaction(true, work); },
    close: () => pool.end(),
  };
}
