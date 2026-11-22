# 분양권 거래 채팅 (features/chat)

## 지금 구조

| 파일 | 역할 |
|---|---|
| `types.ts` | 대화방(`ChatRoom`), 메시지(`ChatMessage`: text / offer / system), 거래 상태 |
| `api/chatRepository.ts` | **저장소 인터페이스 `ChatRepository`** + localStorage 구현체 |
| `lib/identity.ts` | 참여자 id·역할. 로그인이 없어서 이 기기 사용자는 `"me"`, 판매자는 `"seller:<매물 id>"` |
| `lib/useChat.ts` | `useChatRooms`, `useChatRoom`(구독 포함), `useKeyboardInset` |
| `components/ChatRoomScreen.tsx` | 대화 화면 |

화면은 `chatRepository`(인터페이스)만 쓴다. 백엔드를 붙일 때는 **구현체만 바꾸고** 화면 코드는 그대로 둔다.

### 실시간 반영(지금)
- 쓰기마다 localStorage를 새로 읽고 → 고치고 → 저장한 뒤 `BroadcastChannel("zipcok-chat")`으로 `{ type: "changed", roomId }`를 보낸다.
- 같은 브라우저의 다른 탭은 이 알림을 받아 해당 방을 다시 읽는다. BroadcastChannel이 없으면 `storage` 이벤트로 대신한다.
- 한계: 같은 브라우저 안에서만 동작한다. 두 탭이 거의 동시에 쓰면 나중 쓰기가 이긴다(localStorage에는 트랜잭션이 없다).

### 역할과 "상대로 보기"
- 로그인이 없으므로 보낸 사람은 대화방 안의 **역할**(`buyer` / `seller`)로 구분한다.
- 개발 모드(`import.meta.env.DEV`)에서만 대화 화면에 "상대로 보기" 전환이 보인다. 탭마다(sessionStorage) 그 방에서 맡을 역할을 바꿔 판매자 입장을 확인할 수 있다.

## Supabase Realtime으로 바꾸는 방법

### 1. 테이블
```sql
create table chat_rooms (
  id uuid primary key default gen_random_uuid(),
  listing_id bigint not null,
  listing_title text not null,
  buyer_id uuid not null references auth.users(id),
  seller_id uuid not null references auth.users(id),
  status text not null default 'inquiry' check (status in ('inquiry','negotiating','contracting','done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id)          -- 같은 매물·같은 상대면 같은 방
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references chat_rooms(id) on delete cascade,
  sender_id uuid references auth.users(id),          -- system 메시지는 null
  kind text not null check (kind in ('text','offer','system')),
  text text,
  amount bigint, base_amount bigint,                 -- offer 전용(원 단위 정수)
  offer_status text check (offer_status in ('pending','accepted','rejected','superseded')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table chat_reads (                            -- 안 읽은 수 계산용
  room_id uuid references chat_rooms(id) on delete cascade,
  user_id uuid references auth.users(id),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
```
- **RLS**: 세 테이블 모두 `auth.uid() in (buyer_id, seller_id)`인 방만 읽기·쓰기 허용. `chat_messages` insert는 `sender_id = auth.uid()`만 허용.
- **가격 제안 수락·거절**은 클라이언트에서 직접 update하지 말고 RPC(Postgres 함수)로 처리한다. 응답자가 제안자가 아닌지 확인하고, `offer_status`·방 `status`·시스템 메시지를 한 트랜잭션에서 바꾼다. 지금 `respondOffer`의 검사 로직을 그대로 옮기면 된다.
- 리얼타임: `alter publication supabase_realtime add table chat_messages, chat_rooms;`

### 2. 바꿀 위치
| 지금 | Supabase |
|---|---|
| `createLocalStorageChatRepository()` | `createSupabaseChatRepository(supabase)`를 새로 만들어 `chatRepository`에 넣는다 |
| `listRooms` | `select * from chat_rooms order by updated_at desc` (+ 마지막 메시지·안 읽은 수는 view나 RPC로) |
| `findOrCreateRoom` | `upsert ... on conflict (listing_id, buyer_id, seller_id)` |
| `sendText` / `sendOffer` | `chat_messages` insert (offer는 이전 pending을 superseded로 바꾸는 RPC 권장) |
| `respondOffer` / `updateStatus` | RPC |
| `markRead` | `chat_reads` upsert |
| `subscribe` | `supabase.channel('chat').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, ...)` → `{ type: "changed", roomId: payload.new.room_id }`로 바꿔 listener 호출. 방 목록은 `chat_rooms` 변경도 구독 |
| BroadcastChannel | 필요 없다(서버가 모든 기기에 보낸다). 지울 것 |

### 3. 역할·신원
- `lib/identity.ts`의 `ME_ID`를 `supabase.auth.getUser()`의 id로 바꾼다.
- `sellerParticipantId`는 매물의 `seller_user_id`(매물 테이블에 추가)로 바꾼다.
- 보낸 사람 역할은 구현체가 `sender_id`와 방의 `buyer_id/seller_id`를 비교해 정한다. 인터페이스의 `senderRole` 인자는 그대로 두되, 서버는 인증 사용자와 맞는지 다시 확인한다(클라이언트 값을 믿지 않는다).
- "상대로 보기"(개발용)는 실제 계정 두 개로 바꾸면 지운다.

### 4. 외부 연락 차단
지금은 보내기 전 클라이언트 경고만 한다(`findExternalContact`). 서버에도 같은 검사를 두려면 `chat_messages` insert 트리거나 Edge Function에서 패턴을 검사해 `flagged` 컬럼을 채운다.
