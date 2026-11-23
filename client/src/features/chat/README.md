# 채팅 (features/chat)

화면은 프론트 담당이 만든 `pages/ChatSessionList.tsx`(AI 상담 목록)와 `pages/ChatRoom.tsx`(대화방)를 쓴다. 이 폴더에는 데이터와 연결 코드만 둔다.

| 파일 | 역할 |
|---|---|
| `types.ts` | **화면 타입**(프론트 담당 기준): `ChatThread`, `ChatMessage`. 거래 채팅에 필요한 것만 선택 필드로 추가했다(거래 상태, 안 읽은 수, 내 역할, 가격 제안, 메시지 종류) |
| `tradeTypes.ts` | 거래 채팅 **서버 응답 형식**(`TradeChatRoom`, `TradeChatMessage`). 서버(`server/api`)와 함께 쓴다 |
| `lib/adapters.ts` | 서버 형식 → 화면 타입 변환(`toChatThread`, `toChatMessage`) |
| `api/chatRepository.ts` | 거래 채팅 저장소: 개발 서버 API + SSE 실시간(docs/api.md) |
| `api/aiChatRepository.ts` | AI 상담 저장소 인터페이스. 지금은 더미 대화(`data/threads.ts`). AI를 붙일 때 구현체만 바꾼다 |
| `components/TradeChatRoom.tsx` | 서버 대화방을 `pages/ChatRoom.tsx`의 `ChatRoomView`에 연결(읽음 처리, 수락·거절, 거래 완료) |
| `lib/useChat.ts` | `useChatRooms`(거래), `useChatRoom`, `useAiSessions`(AI), `useKeyboardInset` |
| `chat.css` | 대화방 안 거래 기능 스타일(`ch-`): 가격 제안 카드, 시스템 안내, 외부 연락 경고 |

- 구매자·판매자 역할과 권한은 서버가 로그인 정보로 판단한다(`thread.myRole`).
- 실시간: 서버 SSE `chat.changed`를 받아 해당 방을 다시 불러온다. 끊기면 자동으로 다시 연결하고, 다시 연결되면 전체를 다시 불러온다.
- DB로 바꾸는 방법: [docs/db-requests.md](../../../../docs/db-requests.md)
