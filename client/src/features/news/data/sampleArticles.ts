/**
 * 검색 API 키가 없거나 호출이 실패할 때 쓰는 샘플 기사 10개.
 * 실제 지역·사건에 대한 기사처럼 보이지 않도록, 공식 기관 안내 페이지로 연결되는 안내형 글로만 채운다.
 * 화면에는 반드시 "샘플 뉴스"로 표시한다.
 */
export type SampleArticle = {
  title: string;
  summary: string;
  link: string;
  /** 몇 시간 전에 올라온 것으로 보여줄지 */
  hoursAgo: number;
};

export const SAMPLE_QUERY = "샘플";

export const SAMPLE_ARTICLES: SampleArticle[] = [
  {
    title: "청약홈에서 이번 달 청약 일정 확인하는 방법",
    summary: "모집공고·특별공급·1순위 일정은 청약홈 청약 캘린더에서 한 번에 볼 수 있어요.",
    link: "https://www.applyhome.co.kr",
    hoursAgo: 2,
  },
  {
    title: "분양권 실거래가, 국토교통부 실거래가 공개시스템에서 조회해요",
    summary: "단지별 분양권·입주권 거래 금액과 거래일을 직접 확인할 수 있어요.",
    link: "https://rt.molit.go.kr",
    hoursAgo: 5,
  },
  {
    title: "분양권 전매제한 기간, 계약 전에 꼭 확인할 것",
    summary: "전매제한 기간 중 거래는 무효가 될 수 있어요. 모집공고문의 전매제한 항목을 먼저 보세요.",
    link: "https://www.molit.go.kr",
    hoursAgo: 9,
  },
  {
    title: "특별공급과 일반공급, 신청 자격은 어떻게 다를까",
    summary: "신혼부부·생애최초·다자녀 특별공급은 소득·자산 기준이 따로 있어요.",
    link: "https://www.applyhome.co.kr",
    hoursAgo: 20,
  },
  {
    title: "분양권 프리미엄(웃돈) 시세 읽는 법",
    summary: "같은 단지·같은 면적의 최근 거래와 비교하면 프리미엄이 적정한지 가늠할 수 있어요.",
    link: "https://rt.molit.go.kr",
    hoursAgo: 28,
  },
  {
    title: "주택담보대출 규제(LTV·DSR) 기본 정리",
    summary: "대출 한도는 지역과 소득에 따라 달라져요. 잔금 계획 전에 금융위원회 안내를 확인하세요.",
    link: "https://www.fsc.go.kr",
    hoursAgo: 40,
  },
  {
    title: "광역교통망(GTX) 사업 진행 상황 확인하는 곳",
    summary: "노선별 착공·개통 일정은 국토교통부 보도자료로 확인할 수 있어요.",
    link: "https://www.molit.go.kr",
    hoursAgo: 52,
  },
  {
    title: "취득세 계산 전에 알아둘 기본 개념",
    summary: "주택 수와 취득 가격에 따라 세율이 달라져요. 위택스에서 미리 계산해 볼 수 있어요.",
    link: "https://www.wetax.go.kr",
    hoursAgo: 70,
  },
  {
    title: "재건축·재개발 정비사업 정보 찾아보기",
    summary: "서울 정비사업은 '정비사업 정보몽땅'에서 사업 단계와 일정을 볼 수 있어요.",
    link: "https://cleanup.seoul.go.kr",
    hoursAgo: 96,
  },
  {
    title: "중도금 대출 승계, 계약 전 체크리스트",
    summary: "분양권을 살 때는 중도금 대출 승계 가능 여부와 남은 납부 일정을 같이 확인해야 해요.",
    link: "https://www.hf.go.kr",
    hoursAgo: 120,
  },
];
