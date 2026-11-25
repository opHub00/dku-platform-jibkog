# 집콕 데이터베이스

집콕의 청약공고, 분양권 매물, 찜, 거래 채팅 데이터를 PostgreSQL에 저장합니다. 서버에서 매물을 조회할 때는 `listCards`를 사용하면 프론트엔드의 `Listing` 형식으로 받을 수 있습니다.

## 로컬 실행

PostgreSQL 16 이상과 Node.js 24를 사용합니다. 개발용으로 빈 데이터베이스를 만든 뒤, 저장소 최상위 폴더에서 아래 명령을 실행하세요. `DATABASE_URL`의 계정, 비밀번호, DB 이름은 로컬 설정에 맞게 바꿔 주세요.

```powershell
npm install --prefix db
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/jibkog'
node db/manage.mjs migrate
node db/manage.mjs seed
node db/verify.mjs
```

- `migrate`는 아직 적용하지 않은 SQL 파일을 순서대로 실행합니다. 여러 사람이 동시에 실행하면 먼저 시작한 마이그레이션이 끝날 때까지 기다립니다.
- `seed`는 예제 매물 4건과 예나의 찜 2건을 추가합니다. 처음에는 빈 스키마가 필요하고, 같은 시드를 다시 실행해도 데이터가 중복되지 않습니다. 판매자와 채팅, 가격 세부 내역은 테스트용입니다.
- `verify`는 별도의 테스트 스키마에서 마이그레이션, 시드, 매물 조회와 제약 조건을 검사합니다. 실행 계정에는 스키마 생성 권한이 필요합니다. 검사가 끝나면 테스트 스키마를 삭제합니다.

## 매물 조회

청약홈 수집기가 만든 결과 파일은 마이그레이션 후 아래 명령으로 불러옵니다. 파일 경로는 실제 저장 위치에 맞게 바꿔 주세요.

```powershell
node db/import-notices.mjs api/results.json
```

주택관리번호와 공고번호가 같으면 기존 매물 ID와 찜을 유지하고 공고 내용을 갱신합니다. 주택형이나 서류 목록이 `null`이면 이전 값을 유지하고, 빈 배열이면 해당 목록을 비웁니다. 시군구 코드를 확인할 수 없는 공고는 주소만으로 표시합니다. 파일 처리 중 오류가 발생하면 해당 파일의 변경을 모두 되돌립니다.

첫 번째 인자로 연결된 `pg.Client` 또는 `pg.Pool`을 전달하세요. 아래 예시에서 `userId`는 서버가 인증한 사용자의 ID입니다.

```js
import { listCards } from './db/listings.mjs';

const feed = await listCards(db);
const saved = await listCards(db, { scope: 'favorites', userId });
const myListings = await listCards(db, { scope: 'mine', userId });
```

공개 목록은 최근 등록순입니다. 로그인한 사용자의 찜 여부도 표시하려면 `listCards(db, { userId })`를 호출하세요. 검토 대기 매물은 판매자가 자신의 등록 목록에서만 볼 수 있습니다. 청약 접수 기간은 한국 시간 기준이며 시작일과 마감일을 모두 포함합니다.

## 데이터 구조

### 매물과 거래

```mermaid
erDiagram
  districts ||--o{ complexes : contains
  complexes ||--o{ complex_areas : offers
  complexes ||--o{ listings : hosts
  users o|--o{ listings : sells
  users ||--o{ favorites : saves
  listings ||--o{ favorites : appears_in
  listings ||--o{ notice_models : offers
  listings ||--o{ notice_documents : cites
  listings ||--o{ trade_documents : requires
  listings ||--o{ trust_reports : evaluated_in
  listings ||--o{ trade_chats : discussed_in
  users ||--o{ trade_chats : buys
  trade_chats ||--o{ trade_messages : contains
```

### 사용자 설정과 활동

```mermaid
erDiagram
  users ||--o{ favorite_districts : selects
  districts ||--o{ favorite_districts : selected_by
  districts ||--o{ apartment_sales : records
  users ||--o{ notification_preferences : configures
  users ||--o{ document_checks : requests
  listings o|--o{ document_checks : concerns
  users ||--o{ ai_threads : starts
  listings o|--o{ ai_threads : concerns
  ai_threads ||--o{ ai_messages : contains
```

## 기능별 연동 기준

| 기능 | 구현할 때 참고할 내용 |
|---|---|
| 매물 지도 | 공개 매물은 `public_listings`에서 조회합니다. 주소·좌표·사진은 `complexes`, 시군구는 `districts`에 있습니다. 좌표가 없는 매물도 목록에는 표시할 수 있습니다. |
| 분양권 | 분양가, 프리미엄, 옵션비, 납부액은 원 단위 `BIGINT`입니다. 매물 판매 상태와 채팅방 상태는 따로 관리합니다. 판매자 기준 조회에는 `listings.seller_id`를 사용합니다. |
| 찜 | `favorites`는 사용자 ID와 매물 ID의 조합을 저장합니다. 카드의 `liked` 값은 조회한 사용자에 따라 달라집니다. |
| 거래 채팅 | 구매자는 매물 하나당 채팅방 하나를 열 수 있습니다. 메시지를 저장할 때 서버에서 로그인한 사용자가 해당 방의 구매자인지 판매자인지 확인하고 `author_role`을 지정하세요. |
| 서류 점검 | `trade_documents`에는 매물 서류의 현재 상태를 저장합니다. 매물 신뢰도 평가 이력은 `trust_reports`에, 사용자가 직접 요청한 파일 점검 이력은 `document_checks`에 저장합니다. `report_json`에는 프론트엔드의 `TrustReport` 전체가 들어갑니다. |
| 청약홈 | 주택관리번호와 공고번호를 문자열 쌍으로 관리합니다. 주택형은 `notice_models`, 출처 문서는 `notice_documents`에 연결하세요. 모델번호 앞의 0은 유지하고 만 원 단위 금액은 원으로 바꿔 저장합니다. 조회 결과가 실패를 뜻하는 `null`이면 기존 데이터를 유지하세요. |
| 아파트 실거래가 | `apartment_sales`는 시군구와 계약일을 기준으로 조회합니다. 집콕 매물과의 연결은 가정하지 않습니다. 월별 데이터를 갱신할 때는 조회가 끝난 범위만 한 트랜잭션에서 교체하세요. |
| MY·AI | 관심 지역, 알림 설정, 서류 점검 이력, AI 대화는 사용자별로 조회합니다. 현재 회원 등급은 `users.membership`에 저장합니다. |

등록 시각은 `TIMESTAMPTZ`, 청약 접수일은 `DATE`로 저장합니다. 날짜와 금액의 표시 형식, 배지 색상은 매물 카드를 만들 때 결정합니다.

## 참고한 브랜치

화면 데이터는 `main`의 `6af1898`, 분양권 모델은 `feature/presale-trade`의 `176a8a5`, 외부 API 응답 형식은 `feature/api`의 `15e5277`을 기준으로 작성했습니다. 인증, HTTP API, 공공데이터 수집기는 각각 연동이 필요합니다.

## 앱 API 공용 PostgreSQL 연결

루트에서 `pnpm install` 및 `npm install --prefix db`를 실행하고, 실제 DB의 `DATABASE_URL`을 셸 환경변수 또는 루트 .env.local에 설정합니다. 마이그레이션 CLI는 셸 환경변수를 읽습니다.

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/jibkog'
node db/manage.mjs migrate
# 빈 개발 DB에서만 프론트와 동일한 시연 계정을 넣을 때:
$env:DATABASE_SEED_DEMO = '1'
pnpm dev
````

시연용 계정은 최초 요청에서만 생성됩니다. 운영 DB에는 DATABASE_SEED_DEMO를 설정하지 마세요. 기존 db/manage.mjs seed는 별도 SQL 검증용 데이터로, 앱 시드와 함께 사용하지 않습니다. 기존 계정은 비활성 로그인 정보로 유지됩니다. 기존 JSON 파일의 사용자 데이터는 자동으로 이관되지 않습니다. DATABASE_URL 설정 후 연결 오류가 나도 JSON으로 자동 전환하지 않습니다. 공용 DB 연결 정보는 팀 내부에서 안전하게 공유하고 저장소에 커밋하지 마세요.

`node db/verify-store.mjs`는 임시 스키마에서 실제 서비스 계층과 PostgreSQL을 연결하여 검증합니다.
