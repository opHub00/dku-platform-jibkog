import type { PresaleDocument, PresaleListing } from "../types";

const EOK = 100_000_000;
const MAN = 10_000;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const allVerified: PresaleDocument[] = [
  { type: "salesContract", status: "verified" },
  { type: "paymentProof", status: "verified" },
  { type: "optionContract", status: "verified" },
];

/**
 * 시연용 분양권 매물.
 * id 1, 3은 기존 client/src/data/listings.ts의 매물과 같은 id·금액을 쓴다.
 */
export const seedListings: PresaleListing[] = [
  {
    id: 1,
    complexId: "raemian-onebailey",
    seller: {
      nickname: "반포새집",
      realName: "김서연",
      identityVerified: true,
      tradeCount: 3,
    },
    area: 84,
    floor: 18,
    salePrice: 21 * EOK + 6_000 * MAN, // 21억 6,000만
    premium: 3 * EOK + 2_000 * MAN, // 3억 2,000만
    optionCost: 1_850 * MAN,
    paidAmount: 6 * EOK + 4_800 * MAN, // 계약금 10% + 중도금 2회
    description:
      "한강 조망 남향 18층이에요. 발코니 확장과 시스템 에어컨 옵션을 계약했어요. 서류는 모두 준비돼 있어요.",
    documents: allVerified,
    status: "selling",
    liked: true,
    createdAt: hoursAgo(0),
  },
  {
    id: 3,
    complexId: "gwacheon-dietre",
    seller: {
      nickname: "과천토박이",
      realName: "이도윤",
      identityVerified: true,
      tradeCount: 1,
    },
    area: 59,
    floor: 9,
    salePrice: 11 * EOK + 3_000 * MAN, // 11억 3,000만
    premium: 1 * EOK + 1_000 * MAN, // 1억 1,000만
    optionCost: 920 * MAN,
    paidAmount: 3 * EOK + 3_900 * MAN,
    description:
      "정부과천청사역 도보 7분 거리예요. 입주 전 잔금 일정 맞춰드릴 수 있어요.",
    documents: [
      { type: "salesContract", status: "verified" },
      { type: "paymentProof", status: "verified" },
      { type: "optionContract", status: "pending" },
    ],
    status: "selling",
    liked: true,
    createdAt: hoursAgo(26),
  },
  {
    // 시연용: 설명에 위험 문구(외부 연락 유도·가계약금 선입금)
    id: 5,
    complexId: "mapo-river-heritage",
    seller: {
      nickname: "급매처분",
      realName: "박민수",
      identityVerified: false,
      tradeCount: 0,
    },
    area: 84,
    floor: 5,
    salePrice: 15 * EOK + 4_000 * MAN,
    premium: 1 * EOK + 5_000 * MAN,
    optionCost: 1_200 * MAN,
    paidAmount: 1 * EOK + 5_400 * MAN,
    description:
      "급하게 정리해요. 문의는 카톡으로 연락 주세요(ID: mapo84). 가계약금 먼저 보내주시면 바로 잡아드려요. 서류는 계약 날 보여드릴게요.",
    documents: [
      { type: "salesContract", status: "missing" },
      { type: "paymentProof", status: "missing" },
      { type: "optionContract", status: "missing" },
    ],
    status: "selling",
    liked: false,
    createdAt: hoursAgo(3),
  },
  {
    // 시연용: 참고 프리미엄률(8%) 대비 프리미엄이 지나치게 높음(약 40%)
    id: 6,
    complexId: "dongtan-lake-forest",
    seller: {
      nickname: "동탄호수뷰",
      realName: "최유진",
      identityVerified: true,
      tradeCount: 2,
    },
    area: 84,
    floor: 22,
    salePrice: 6 * EOK + 2_000 * MAN, // 6억 2,000만
    premium: 2 * EOK + 5_000 * MAN, // 2억 5,000만
    optionCost: 1_100 * MAN,
    paidAmount: 1 * EOK + 2_400 * MAN,
    description:
      "호수공원 정면 뷰 고층이에요. 같은 라인에서 가장 좋은 동호수예요.",
    documents: allVerified,
    status: "selling",
    liked: false,
    createdAt: hoursAgo(50),
  },
  {
    id: 7,
    complexId: "songdo-ocean-parkview",
    seller: {
      nickname: "송도라이프",
      realName: "정하늘",
      identityVerified: true,
      tradeCount: 5,
    },
    area: 98,
    floor: 31,
    salePrice: 8 * EOK + 7_000 * MAN,
    premium: 4_800 * MAN,
    optionCost: 1_400 * MAN,
    paidAmount: 2 * EOK + 6_100 * MAN,
    description:
      "센트럴파크와 바다가 함께 보여요. 예약 중이라 계약이 무산되면 다시 열어둘게요.",
    documents: allVerified,
    status: "reserved",
    liked: false,
    createdAt: hoursAgo(80),
  },
];
