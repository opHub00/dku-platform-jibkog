# 분양권 거래 채팅 (features/chat)

| 파일 | 역할 |
|---|---|
| `types.ts` | 대화방(`ChatRoom`), 메시지(`ChatMessage`: text / offer / system), 거래 상태. 서버와 함께 쓴다 |
| `api/chatRepository.ts` | **저장소 인터페이스 `ChatRepository`** + HTTP 구현체(개발 서버 API) |
| `lib/useChat.ts` | `useChatRooms`, `useChatRoom`(구독 포함), `useKeyboardInset` |
| `lib/format.ts`, `lib/names.ts` | 시간·금액 표시, 아바타 글자 |
| `components/ChatRoomScreen.tsx` | 대화 화면 |

- 화면은 `chatRepository`(인터페이스)만 쓴다.
- 구매자·판매자 역할과 권한은 **서버가 로그인 정보로 판단**한다(`room.myRole`).
- 실시간: 서버 SSE(`/api/events`)의 `chat.changed`를 받아 해당 방을 다시 불러온다(`features/auth/lib/serverEvents.ts`). 끊기면 브라우저가 자동으로 다시 연결하고, 다시 연결되면 전체를 다시 불러온다.
- API 명세: [docs/api.md](../../../../docs/api.md). DB로 바꾸는 방법: [docs/db-requests.md](../../../../docs/db-requests.md).

## Supabase Realtime으로 바꾸려면
지금 서버 구조에서는 **서버 저장소(`server/store`)를 DB로 바꾸는 것**이 우선이다(docs/db-requests.md). 실시간까지 Supabase로 옮긴다면 다음과 같다.
- `chatRepository.subscribe`에서 `onServerEvent("chat.changed")` 대신 `supabase.channel(...).on('postgres_changes', { table: 'trade_messages' }, ...)`를 구독한다.
- 수락·거절·완료처럼 여러 행을 함께 바꾸는 작업은 RPC(Postgres 함수)로 옮긴다. 지금 `server/api/services.ts`의 `respondOffer`, `completeChat` 검사 로직을 그대로 옮기면 된다.
- 행 단위 보안(RLS)은 docs/db-requests.md 4번 표와 같게 맞춘다.
