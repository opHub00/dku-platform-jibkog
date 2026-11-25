# DB 담당자에게 드리는 요청

로그인, 매물 공유, 거래 채팅을 지금은 개발 서버가 **JSON 파일 하나**(`.data/jibkog.json`)에 저장합니다. 이 문서는 그 저장 부분을 실제 DB(`origin/feature/database`의 PostgreSQL 스키마)로 바꾸기 위해 필요한 것을 정리했습니다.

기준 스키마: `db/migrations/001_initial.sql`, `002_document_checks.sql`

## 0. 한 줄 요약

- 화면과 API는 그대로 두고, **`server/store/` 안의 저장 함수만 SQL로 바꾸면** 됩니다.
- 그러려면 001 스키마에 **필드 몇 개와 테이블 2개**를 추가해야 합니다(아래 2번).
- 권한 판단(누가 무엇을 할 수 있는지)은 이미 서버 코드가 합니다(아래 4번). DB에서는 "실수로라도 깨지면 안 되는 규칙"만 제약조건으로 걸어 주시면 됩니다.

## 1. 그대로 쓰는 테이블

필드 이름도 001과 똑같이 맞춰 두었습니다. 서버의 행(row) 타입은 `server/store/types.ts`에 있습니다.

| 테이블 | 서버에서 쓰는 곳 | 비고 |
|---|---|---|
| `districts` | 단지의 시도·시군구 | id는 `"서울-서초구"` 형식으로 넣고 있음 |
| `complexes` | 단지 목록 | 그대로 |
| `complex_areas` | 단지별 면적 선택지 | 그대로 |
| `listings` | 분양권 매물(`type='trade'`만) | 그대로. 청약공고(`notice`)는 아직 프론트 고정 데이터 |
| `favorites` | 찜 | 그대로 |
| `trade_documents` | 매물 서류 3종 상태 | 그대로(`storage_key`는 아직 null) |
| `trust_reports` | 신뢰 리포트 | 그대로. 화면용 전체 내용을 `report_json`에 저장 |
| `trade_chats` | 거래 채팅방 | 필드 추가 필요(아래) |
| `trade_messages` | 채팅 메시지 | 필드 추가·제약 완화 필요(아래) |
| `users` | 회원 | 필드 추가 필요(아래) |

안 쓰는 테이블: `favorite_districts`, `notice_models`, `notice_documents`, `apartment_sales`, `ai_threads`, `ai_messages`, `notification_preferences`, `document_checks`. 관심지역 같은 프로필 정보는 지금 브라우저에만 저장합니다.

## 2. 추가해야 할 필드·테이블

쉽게 말해 **"로그인"과 "채팅의 세부 상태"를 담을 칸**이 001에 없습니다.

### 2-1. `users`: 로그인 정보
| 추가 필드 | 타입 | 왜 필요한가 |
|---|---|---|
| `email` | `TEXT NOT NULL` | 로그인 아이디. 소문자로 저장 |
| `password_hash` | `TEXT NOT NULL` | 비밀번호를 그대로 저장하지 않고, 되돌릴 수 없게 바꾼 값(scrypt)만 저장 |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | 가입 시각 |

### 2-2. 새 테이블 `sessions`: "이 브라우저는 로그인했다"는 표시
```sql
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                 -- 쿠키 토큰의 SHA-256(원문은 저장하지 않음)
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL              -- 30일 뒤
);
```

### 2-3. `trade_chats`: 거래 단계
001의 `status`는 `open/closed` 두 가지뿐입니다. 화면에는 "문의중 → 가격협의 → 계약진행 → 완료" 네 단계가 필요합니다.

| 추가 필드 | 타입 | 왜 필요한가 |
|---|---|---|
| `deal_status` | `TEXT NOT NULL DEFAULT 'inquiry' CHECK (deal_status IN ('inquiry','negotiating','contracting','done'))` | 거래 단계. 완료되면 기존 `status`도 `closed`로 맞춰서 바꿈 |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | 방을 만든 시각 |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | 마지막 메시지 시각. 채팅 목록을 최근 순으로 정렬하는 데 씀 |

### 2-4. `trade_messages`: 가격 제안과 안내 메시지
001에는 일반 글만 있습니다. 화면에는 **가격 제안 카드**(수락·거절)와 **시스템 안내**("판매자가 제안을 수락했어요")가 필요합니다.

| 변경 | 내용 |
|---|---|
| 추가 `kind` | `TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','offer','system'))` |
| 추가 `offer_amount` | `BIGINT CHECK (offer_amount > 0)`: 제안한 총 매수가(원) |
| 추가 `offer_base_amount` | `BIGINT`: 제안 당시 총 필요자금(원) |
| 추가 `offer_status` | `TEXT CHECK (offer_status IN ('pending','accepted','rejected','superseded'))` |
| 추가 `responded_at` | `TIMESTAMPTZ`: 판매자가 답한 시각 |
| **완화** `author_role` | 시스템 안내는 쓴 사람이 없으므로 **NULL 허용**이 필요합니다. `CHECK (author_role IN ('buyer','seller') OR (author_role IS NULL AND kind = 'system'))` |
| 추가 제약 | `CHECK ((kind = 'offer') = (offer_amount IS NOT NULL AND offer_status IS NOT NULL))`: 제안이면 금액과 상태가 반드시 있어야 함 |

### 2-5. 새 테이블 `trade_chat_reads`: "어디까지 읽었나"
채팅 목록의 안 읽은 수를 세려면 사람마다 마지막으로 읽은 메시지를 알아야 합니다.
```sql
CREATE TABLE trade_chat_reads (
  chat_id INTEGER NOT NULL REFERENCES trade_chats ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users ON DELETE CASCADE,
  last_read_message_id INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);
```

## 3. 필요한 제약조건·인덱스

**제약조건**은 "어떤 프로그램이 실수해도 DB가 거부하는 규칙"입니다.

| 대상 | 제약 | 이유 |
|---|---|---|
| `users(email)` | `UNIQUE` | 같은 이메일로 두 번 가입 방지 |
| `trade_chats(listing_id, buyer_id)` | `UNIQUE`(**001에 이미 있음**) | 같은 매물·같은 구매자 방은 하나 |
| `trade_chats` | `CHECK (buyer_id <> seller_id)`(**001에 이미 있음**) | 내 매물에 내가 문의 금지 |
| `trade_chats(listing_id, seller_id)` → `listings(id, seller_id)` | FK(**001에 이미 있음**) | 방의 판매자 = 매물의 판매자 |
| `trade_messages(chat_id, id)` 중 같은 방에서 `offer_status='pending'` | 부분 유니크 인덱스 `CREATE UNIQUE INDEX one_pending_offer ON trade_messages(chat_id) WHERE offer_status = 'pending';` | 답변 대기 제안은 방마다 하나 |
| `trade_chat_reads.last_read_message_id` | 같은 방 메시지여야 함 | 트리거로 검사하거나, 서버 검사로 충분하면 생략 |
| `sessions.expires_at` | 만료된 세션은 주기적으로 삭제 | 로그인할 때 서버가 지우고 있음 |

**인덱스**는 "자주 찾는 조건으로 빨리 찾게 해 주는 색인"입니다.

| 인덱스 | 쓰는 곳 |
|---|---|
| `CREATE INDEX trade_chats_buyer ON trade_chats(buyer_id, updated_at DESC);` | 내 채팅 목록(구매자) |
| `CREATE INDEX trade_chats_seller ON trade_chats(seller_id, updated_at DESC);` | 내 채팅 목록(판매자), 판매자 거래 이력 |
| `trade_messages_history (chat_id, id)` | 메시지 목록, 마지막 메시지, 안 읽은 수(**001에 이미 있음**) |
| `CREATE INDEX sessions_user ON sessions(user_id);` | 로그아웃·만료 정리 |
| `CREATE INDEX trust_reports ...` `reports_history (listing_id, evaluated_at DESC)` | 최근 리포트(**001에 이미 있음**) |

## 4. 권한 규칙

서버(`server/api/services.ts`)가 **모든 요청마다** 로그인한 사용자를 확인하고 아래 규칙을 지킵니다. DB 쪽에서 행 단위 보안(RLS)을 쓰신다면 같은 규칙으로 맞춰 주세요.

| 데이터 | 읽기 | 쓰기 |
|---|---|---|
| `users` | 본인만 전체. 다른 사람에게는 닉네임·본인인증 여부만, 실명은 가운데를 가려서(`김*연`) | 본인 가입만 |
| `sessions` | 서버만(브라우저에 노출 금지) | 서버만 |
| `listings` | 누구나. 단 `status='review'`는 판매자 본인만 | 등록: 로그인한 사람이 판매자로. 수정: **판매자 본인만** |
| `favorites` | 본인 것만 | 본인 것만 |
| `trust_reports`, `trade_documents` | 매물을 볼 수 있는 사람 | 매물 등록할 때 판매자 |
| `trade_chats` | **그 방의 구매자·판매자만** | 방 만들기: 구매자(자기 매물 제외). 상태 변경: 아래 규칙대로 |
| `trade_messages` | **그 방의 구매자·판매자만** | 일반 글: 당사자. 가격 제안: **구매자만**. 수락·거절: **판매자만**. 거래 완료: **판매자만**(계약진행일 때). 완료된 방에는 못 씀 |
| `trade_chat_reads` | 본인 것만 | 본인 것만 |

## 5. 서버 저장소에서 DB로 바꿔야 할 함수

모두 `server/store/types.ts`의 `StoreTx` 인터페이스에 있습니다. **JSON 파일 구현체(`server/store/jsonFileStore.ts`)와 같은 이름·입력·결과로 SQL 구현체를 하나 만들어** `server/api/app.ts`의 `createJsonFileStore(...)` 한 줄만 바꾸면 됩니다.

| 함수 | SQL로 하면 |
|---|---|
| **트랜잭션** `Store.read(work)` / `Store.write(work)` | `write`는 `BEGIN` → `work(tx)` → `COMMIT`(오류면 `ROLLBACK`). 같은 연결(client)로 `tx` 함수들을 실행 |
| `insertUser`, `findUserById`, `findUserByEmail` | `INSERT ... RETURNING *`, `SELECT ... WHERE id/email = $1` |
| `insertSession`, `findSession`, `deleteSession`, `deleteExpiredSessions` | `sessions` 테이블 INSERT/SELECT/DELETE |
| `listDistricts`, `listComplexes`, `listComplexAreas`, `findComplex` | 단순 SELECT |
| `listTradeListings`, `findListing` | `SELECT * FROM listings WHERE type='trade'`(공개 여부는 서버가 거름) |
| `insertListing`, `updateListing` | `INSERT ... RETURNING *`, `UPDATE ... SET description/status ... RETURNING *` |
| `listTradeDocuments`, `upsertTradeDocument` | `WHERE listing_id = ANY($1)`, `INSERT ... ON CONFLICT (listing_id, kind) DO UPDATE` |
| `insertTrustReport`, `latestTrustReports` | INSERT, `SELECT DISTINCT ON (listing_id) ... ORDER BY listing_id, evaluated_at DESC, id DESC` |
| `listFavoriteListingIds`, `addFavorite`, `removeFavorite` | SELECT, `INSERT ... ON CONFLICT DO NOTHING`, DELETE |
| `listChatsForUser`, `findChat`, `findChatByListingAndBuyer` | `WHERE buyer_id = $1 OR seller_id = $1` 등 |
| `insertChat`, `updateChat` | INSERT / UPDATE(`status`, `deal_status`, `updated_at`) |
| `countCompletedTradesBySeller` | `SELECT count(*) WHERE seller_id = $1 AND deal_status = 'done'` |
| `listMessages`, `findMessage`, `lastMessage` | `ORDER BY id`, `ORDER BY id DESC LIMIT 1` |
| `insertMessage`, `updateMessage` | INSERT / UPDATE(`offer_status`, `responded_at`) |
| `supersedePendingOffers` | `UPDATE trade_messages SET offer_status='superseded' WHERE chat_id=$1 AND offer_status='pending'` |
| `countMessagesAfter` | `SELECT count(*) WHERE chat_id=$1 AND id > $2 AND author_role = $3` |
| `findRead`, `upsertRead` | `INSERT ... ON CONFLICT (chat_id, user_id) DO UPDATE SET last_read_message_id = GREATEST(...)` |

참고할 점:
- **id는 DB가 만듭니다**(IDENTITY). JSON 구현체의 `next_ids`가 하던 일입니다.
- 시드 데이터(`server/store/seed.ts`)는 처음 실행할 때 파일이 없으면 넣습니다. DB에서는 `db/seed.sql`과 합치거나, 같은 내용을 SQL로 옮겨 주세요. 시드 계정 비밀번호는 개발용이므로 운영 DB에는 넣지 마세요.
- 채팅 목록 하나를 만들 때 방마다 상대 이름·마지막 메시지·안 읽은 수를 따로 조회합니다(지금은 파일이라 빠름). DB에서는 한 번의 쿼리(JOIN + 집계)로 합친 전용 함수를 추가해도 됩니다. 그때는 `StoreTx`에 함수를 하나 더하고 `services.ts`의 `listChats`에서 쓰면 됩니다.
- 금액은 원 단위 정수입니다. 1,000조 원까지 받도록 서버가 막고 있어서 자바스크립트 숫자로 안전하고, DB에서는 `BIGINT`입니다.
