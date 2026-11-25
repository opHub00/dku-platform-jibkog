# 집콕 앱 API

개발 서버(`pnpm dev`)에 붙어 있는 API입니다. 코드는 `server/api/`에 있고, 데이터는 지금 `.data/jibkog.json` 파일에 저장합니다(DB로 바꾸는 방법은 [db-requests.md](./db-requests.md)).

- 주소는 모두 같은 출처(`http://localhost:3000`)의 `/api/...`입니다.
- 요청·응답 본문은 JSON입니다. **본문이 있는 요청은 `Content-Type: application/json`이 필수**입니다(아니면 415). 다른 사이트에서 폼으로 요청을 위조하는 것(CSRF)을 막는 장치입니다.
- 금액은 모두 **원 단위 정수**, 시각은 ISO 8601 문자열(UTC)입니다.

## 공통 규칙

### 로그인(세션)
- 로그인·회원가입에 성공하면 서버가 `Set-Cookie: jibkog_session=<토큰>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`(30일)을 보냅니다.
- 브라우저가 쿠키를 자동으로 보냅니다. 자바스크립트로는 이 쿠키를 읽을 수 없습니다(HttpOnly).
- 서버는 토큰 원문이 아니라 SHA-256 해시만 저장합니다.
- **구매자·판매자·작성자 같은 신원은 항상 서버가 세션으로 판단합니다.** 요청 본문에 사용자 id나 역할을 넣어도 무시합니다.

### 오류 응답
```json
{ "error": { "code": "forbidden", "message": "이 대화방의 당사자가 아니에요" } }
```
| 상태 | code | 뜻 |
|---|---|---|
| 400 | `bad_request` | 값이 빠졌거나 형식이 틀림 |
| 401 | `unauthorized` / `invalid_credentials` | 로그인 필요 / 이메일·비밀번호 불일치(가입 여부는 알려주지 않음) |
| 403 | `forbidden` | 로그인은 했지만 권한 없음(남의 방·남의 매물, 역할이 다름) |
| 404 | `not_found` | 없음(또는 볼 수 없는 매물) |
| 409 | `conflict` | 지금 상태에서는 할 수 없음(이미 가입한 이메일, 내 매물에 문의, 이미 답한 제안 등) |
| 413 / 415 | `payload_too_large` / `unsupported_media_type` | 본문이 너무 큼(256KB) / JSON이 아님 |

### 화면 타입
응답 형식은 프론트 타입과 같습니다.
- `AuthUser`: `client/src/features/auth/types.ts`
- `Complex`, `PresaleListing`, `TrustReport`: `client/src/features/presale/types.ts`
- `ChatRoom`, `ChatMessage`: `client/src/features/chat/types.ts`

---

## 인증 `/api/auth`

| 메서드·주소 | 로그인 | 요청 | 응답 |
|---|---|---|---|
| `POST /api/auth/signup` | - | `{ email, password, nickname, realName }` | 201 `{ user: AuthUser }` + 세션 쿠키 |
| `POST /api/auth/login` | - | `{ email, password }` | 200 `{ user: AuthUser }` + 세션 쿠키 |
| `POST /api/auth/logout` | - | `{}` | 204, 쿠키 삭제 |
| `GET /api/auth/me` | 필요 | - | 200 `{ user: AuthUser }` / 401 |
| `POST /api/auth/verify-identity` | 필요 | `{ code: "123456" }` | 200 `{ user: AuthUser }` (`identityVerified: true`) / 400 / 401 |

- 이메일: 소문자로 저장, 중복이면 409.
- 비밀번호: 8~128자. `scrypt`(N=16384, r=8, p=1, 솔트 16바이트)로 해시해 `scrypt$N$r$p$솔트$해시` 형식으로 저장합니다.
- 닉네임: 2~12자. 채팅 상대에게 보이는 이름입니다.
- 실명(`realName`): 2~30자. 서버 `users.real_name`에 저장하며 본인 계정 응답과 본인 매물에는 원문, 다른 사람의 매물에는 가운데를 가린 이름으로 표시합니다.
- 본인 인증은 **시연용 데모 인증**입니다. 실제 문자를 보내지 않으며 숫자 6자리면 무엇이든 통과합니다. 서버가 로그인한 사용자만 `identity_verified`를 `true`로 바꿉니다.

```json
// AuthUser
{ "id": 6, "email": "me@example.com", "nickname": "집콕회원", "realName": "김서연", "identityVerified": false }
```

**개발용 시드 계정**(처음 실행할 때 자동 생성, 시드 매물의 판매자): `seller1@jibkog.dev` ~ `seller5@jibkog.dev`, 비밀번호 `jibkog-demo-1234`. 배포 전에 지워야 합니다.

## 단지·매물 `/api/complexes`, `/api/listings`

| 메서드·주소 | 로그인 | 요청 | 응답 | 권한 규칙 |
|---|---|---|---|---|
| `GET /api/complexes` | - | - | `{ complexes: Complex[] }` | 누구나 |
| `GET /api/listings` | 선택 | - | `{ listings: PresaleListing[] }` 최신순 | 검토 대기(`review`) 매물은 판매자 본인에게만 포함 |
| `GET /api/listings/:id` | 선택 | - | `{ listing }` | 위와 같음(남의 검토 대기 매물은 404) |
| `POST /api/listings` | 필요 | 아래 참고 | 201 `{ listing }` | 판매자 = 로그인한 나 |
| `PATCH /api/listings/:id` | 필요 | `{ description?, status? }` | `{ listing }` | **판매자 본인만**(남이면 403) |
| `PUT /api/listings/:id/favorite` | 필요 | `{ liked: boolean }` | `{ liked }` | 내 찜만 바뀜 |

매물 등록 본문:
```json
{
  "complexId": "gwacheon-dietre", "area": 84, "floor": 12,
  "salePrice": 1500000000, "premium": 150000000, "optionCost": 10000000, "paidAmount": 450000000,
  "description": "남향 12층이에요. 발코니 확장했어요.",
  "documents": [{ "type": "salesContract", "status": "pending" }],
  "verification": {
    "contract": { "mode": "demo", "result": { "complexName": "단지명", "exclusiveArea": 84, "salePrice": 1500000000, "contractorName": "김서연", "contractDate": null, "confidence": 0.55, "forgeryNotes": [] } },
    "screening": { "mode": "demo", "result": { "findings": [] } }
  }
}
```
- 전매제한 기간 중인 단지면 409입니다.
- `paidAmount`는 `salePrice + optionCost` 이하여야 합니다.
- 서버가 `verification`의 계약서 인식·설명 검사 결과와 저장된 판매자 실명·인증 여부를 사용해 신뢰 점수를 계산합니다. 요청의 `seller`나 `trust` 값은 신원·점수 판단에 쓰지 않습니다.
- 서버 계산 점수가 50 미만이면 `status: "review"`(검토 대기)로 저장되어 공개 목록에서 빠집니다.
- 제목은 서버가 `"<단지명> <면적>㎡"`로 만듭니다.
- `PATCH`의 `status`는 `selling` / `reserved` / `sold`만 가능하고, 검토 대기 매물은 바꿀 수 없습니다.

매물 응답에서 알아둘 점:
- `seller.realName`: 본인이면 실명, 다른 사람이면 가운데를 가린 이름(`김*연`)입니다.
- `seller.tradeCount`: 그 판매자가 '완료'한 거래 채팅 수입니다.
- `isMine`: 로그인한 내가 판매자인지입니다.
- `liked`: 로그인한 내가 찜했는지입니다.
- `trust`: 가장 최근 신뢰 리포트입니다.
- `documents`: 항상 3종이고, 없으면 `missing`입니다.

> 계약서 인식·설명 검사 결과는 지금 브라우저가 보냅니다. 서버는 점수를 다시 계산하지만 인식 결과의 출처까지 검증하지는 않습니다. 실서비스에서는 AI 검증도 서버에서 실행해야 합니다.

## 거래 채팅 `/api/chats`

모든 채팅 API는 **로그인이 필요**하고, **그 방의 구매자·판매자만** 쓸 수 있습니다(아니면 403, 방이 없으면 404).

| 메서드·주소 | 누가 | 요청 | 응답 | 규칙 |
|---|---|---|---|---|
| `GET /api/chats` | 당사자 | - | `{ rooms: ChatRoom[] }` 최근 활동순 | 내가 구매자이거나 판매자인 방만 |
| `POST /api/chats` | 구매자 | `{ listingId }` | 201(새 방) / 200(기존 방) `{ room }` | 같은 매물·같은 구매자면 기존 방. **내 매물이면 409**. 검토 대기·판매 완료 매물은 새 방 409 |
| `GET /api/chats/:id` | 당사자 | - | `{ room }` | |
| `GET /api/chats/:id/messages` | 당사자 | - | `{ messages: ChatMessage[] }` 오래된 순 | |
| `POST /api/chats/:id/messages` | 당사자 | `{ text }`(1~500자) | 201 `{ message }` | 완료된 방이면 409 |
| `POST /api/chats/:id/offers` | **구매자만** | `{ amount }` | 201 `{ message }` | 계약진행·완료면 409. 이전 '답변 대기' 제안은 '새 제안으로 바뀜'. 거래 상태 → 가격협의 |
| `POST /api/chats/:id/offers/:messageId/accept` | **판매자만** | `{}` | 204 | 답변 대기 제안만. 거래 상태 → 계약진행, 시스템 메시지 추가 |
| `POST /api/chats/:id/offers/:messageId/reject` | **판매자만** | `{}` | 204 | 시스템 메시지 추가 |
| `POST /api/chats/:id/read` | 당사자 | `{}` | 204 | 지금까지 온 메시지를 읽음 처리 |
| `POST /api/chats/:id/complete` | **판매자만** | `{}` | 204 | 계약진행일 때만. 거래 상태 → 완료, 방 `status` → `closed` |

```json
// ChatRoom
{
  "id": 1, "listingId": 8, "listingTitle": "마포 리버 헤리티지 59㎡",
  "myRole": "buyer", "counterpart": { "id": 6, "nickname": "새판매자" },
  "status": "negotiating", "createdAt": "...", "updatedAt": "...",
  "lastMessage": { "preview": "가격 제안 10억 9,000만", "at": "...", "senderRole": "buyer" },
  "unread": 0
}
// ChatMessage (kind: text | offer | system)
{ "id": 2, "roomId": 1, "kind": "offer", "senderRole": "buyer", "amount": 1090000000,
  "baseAmount": 1109000000, "status": "pending", "respondedAt": null, "createdAt": "..." }
```
- `myRole`: 서버가 로그인 정보로 정한 내 역할입니다.
- `counterpart`: 상대방이에요. 닉네임만 공개합니다.
- `status`(거래 상태): `inquiry` 문의중 → `negotiating` 가격협의 → `contracting` 계약진행 → `done` 완료.
- `unread`: 상대가 보낸 메시지 중 내가 읽음 처리한 뒤에 온 것의 수입니다. 내가 보낸 메시지는 보내는 순간 읽은 것으로 칩니다.
- `baseAmount`: 서버가 매물 정보(분양가 + 프리미엄 + 옵션비)로 계산한 총 필요자금입니다.

## 실시간 `GET /api/events` (SSE)

로그인한 브라우저가 `new EventSource("/api/events")`로 연결합니다(로그인 안 했으면 401).

```
retry: 3000                 ← 끊기면 3초 뒤 자동 재연결
event: ready                ← 연결됨(재연결이면 프론트가 목록을 다시 불러옴)
event: chat.changed         data: {"type":"chat.changed","chatId":1}
event: listing.changed      data: {"type":"listing.changed","listingId":8}
: ping                      ← 25초마다(연결 유지용)
```

| 이벤트 | 누구에게 | 언제 |
|---|---|---|
| `chat.changed` | 그 방의 구매자·판매자 | 방 생성, 메시지, 가격 제안, 수락·거절, 완료 |
| `chat.changed` | 나에게만 | 내가 읽음 처리(내 다른 기기의 안 읽은 수 갱신) |
| `listing.changed` | 접속한 모두 | 매물 등록·수정 |
| `listing.changed` | 나에게만 | 내 찜 변경 |

이벤트에는 **무엇이 바뀌었는지만** 담깁니다. 브라우저는 받은 뒤 해당 API를 다시 불러 최신 상태를 얻습니다. 그래서 이벤트를 놓쳐도 다시 불러오면 맞춰집니다.

## 기존 API(참고)
- `POST /api/ai/extract-contract`, `POST /api/ai/screen-description`: AI 문서 인식·위험 문구 탐지. 키가 없으면 503입니다.
- `POST /api/news`: 맞춤 뉴스. 요청 본문은 `{ queries }`뿐입니다.
- 위 두 가지는 `server/vitePluginAiApi.ts`에 있고, 로그인은 필요 없습니다.
