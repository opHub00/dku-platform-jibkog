/** 알림 종류. listing: 매물 관련 맞춤 알림, chat: 채팅/문의, system: 그 외 앱 사용 알림 */
export type NotificationCategory = "listing" | "chat" | "system";

export type AppNotification = {
  id: number;
  category: NotificationCategory;
  dot: "green" | "sand" | "navy";
  title: string;
  detail: string;
  time: string;
};

export const notifications: AppNotification[] = [
  { id: 1, category: "listing", dot: "green", title: "관심지역에 새 거래가 올라왔어요", detail: "래미안 원베일리 · 프리미엄 3.2억", time: "10분 전" },
  { id: 2, category: "chat", dot: "navy", title: "판매자에게 새 메시지가 도착했어요", detail: "마포 리버 헤리티지 거래 채팅", time: "1시간 전" },
  { id: 3, category: "listing", dot: "sand", title: "청약 일정이 곧 시작돼요", detail: "마곡나루역 오피스텔 · 11월 24일", time: "어제" },
  { id: 4, category: "chat", dot: "navy", title: "내 매물에 새 문의가 들어왔어요", detail: "래미안 원베일리 84㎡ · 문의 1건", time: "어제" },
  { id: 5, category: "listing", dot: "green", title: "관심지역에 새 매물이 올라왔어요", detail: "과천 디에트르 퍼스티지 · 12억 4,000만", time: "2일 전" },
  { id: 6, category: "system", dot: "sand", title: "본인 인증이 완료됐어요", detail: "이제 모든 기능을 이용할 수 있어요", time: "3일 전" },
  { id: 7, category: "system", dot: "navy", title: "집콕 프리미엄 결제가 예정돼 있어요", detail: "다음 결제일 2026. 12. 18", time: "5일 전" },
  { id: 8, category: "system", dot: "sand", title: "이용약관이 업데이트됐어요", detail: "변경된 약관을 확인해보세요", time: "1주 전" },
];
