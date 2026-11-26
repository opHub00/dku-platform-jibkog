import type { ChatThread } from "../types";

/** 목업용 더미 대화 데이터. 배열 순서가 최근 활동 순이다. */
export const chatThreads: ChatThread[] = [
  {
    id: "ai-1",
    kind: "ai",
    name: "서초구 분양권 추천",
    subtitle: "오늘 오전 9:03",
    messages: [
      { id: "1", sender: "other", text: "안녕하세요! 집콕 AI 상담이에요. 무엇을 도와드릴까요?", time: "오전 9:02" },
      { id: "2", sender: "me", text: "서초구에서 거래 가능한 분양권 추천해줘", time: "오전 9:03" },
      { id: "3", sender: "other", text: "서초구 반포동 래미안 원베일리 84㎡ 매물이 조건에 잘 맞아요. 프리미엄 3억 2천, 거래 가능 상태예요.", time: "오전 9:03" },
    ],
  },
  {
    id: "ai-2",
    kind: "ai",
    name: "래미안 원베일리 질문",
    subtitle: "어제",
    listingTitle: "래미안 원베일리 84㎡",
    listingPrice: "24억 8,000만",
    listingImage: "/assets/apt-city.jpg",
    messages: [
      { id: "1", sender: "me", text: "이 매물 전매 시 세금은 얼마나 나올까?", time: "어제" },
      { id: "2", sender: "other", text: "보유 기간에 따라 달라져요. 상세 화면의 수익률 시뮬레이터로 구체적인 금액을 계산해볼 수 있어요.", time: "어제" },
    ],
  },
  {
    id: "seller-1",
    kind: "seller",
    name: "판매자",
    subtitle: "진행중",
    listingTitle: "래미안 원베일리 84㎡",
    listingPrice: "24억 8,000만",
    listingImage: "/assets/apt-city.jpg",
    messages: [
      { id: "1", sender: "other", text: "안녕하세요. 문의하신 동·호수 확인했어요.", time: "오전 10:40" },
      { id: "2", sender: "me", text: "네 감사합니다. 입주 시기 협의 가능할까요?", time: "오전 10:41" },
      { id: "3", sender: "other", text: "네, 2027년 8월 전후로 조율 가능해요.", time: "오전 10:42" },
    ],
  },
  {
    id: "seller-2",
    kind: "seller",
    name: "판매자",
    subtitle: "완료",
    listingTitle: "마포 리버 헤리티지 59㎡",
    listingPrice: "11억 4,000만",
    listingImage: "/assets/modern-home.jpg",
    messages: [
      { id: "1", sender: "other", text: "계약서류 점검 결과를 확인해보세요.", time: "어제" },
      { id: "2", sender: "me", text: "확인했습니다. 감사해요.", time: "어제" },
    ],
  },
];
