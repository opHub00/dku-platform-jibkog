/** 금액은 모두 원 단위 정수다. 화면에 보여줄 때만 lib/format.ts로 변환한다. */
export type Won = number;

export type Sido = "서울" | "경기" | "인천";

export type Complex = {
  id: string;
  name: string;
  /** 동 단위까지의 주소. 예: "서울 서초구 반포동" */
  address: string;
  sido: Sido;
  sigungu: string;
  lat: number;
  lng: number;
  /** 입주 예정 월. "YYYY-MM" */
  moveInMonth: string;
  /** 전매제한 해제일 "YYYY-MM-DD". 제한이 없으면 null */
  resaleRestrictionEndsOn: string | null;
  /** 공급면적 목록(㎡) */
  supplyAreas: number[];
  /** 참고 프리미엄률. 분양가 대비 비율(0.15 = 15%) */
  referencePremiumRate: number;
  /** 목록 카드에 쓰는 대표 이미지 경로 */
  image: string;
};

export type Seller = {
  nickname: string;
  realName: string;
  identityVerified: boolean;
  /** 완료된 거래 횟수 */
  tradeCount: number;
};

export type PresaleDocumentType =
  | "salesContract" // 분양계약서
  | "paymentProof" // 납부확인서
  | "optionContract"; // 옵션계약서

export type PresaleDocumentStatus = "verified" | "pending" | "missing";

export type PresaleDocument = {
  type: PresaleDocumentType;
  status: PresaleDocumentStatus;
};

export type PresaleListingStatus = "selling" | "reserved" | "sold";

export type PresaleListing = {
  id: number;
  complexId: string;
  seller: Seller;
  /** 공급면적(㎡) */
  area: number;
  floor: number;
  /** 분양가 */
  salePrice: Won;
  /** 프리미엄(웃돈) */
  premium: Won;
  /** 옵션비(발코니 확장 등) */
  optionCost: Won;
  /** 지금까지 납부한 금액(계약금·중도금) */
  paidAmount: Won;
  description: string;
  documents: PresaleDocument[];
  status: PresaleListingStatus;
  liked: boolean;
  /** 등록 시각 ISO 문자열 */
  createdAt: string;
};

/** 매물 등록 시 입력값. id·상태·찜·등록시각은 저장소가 채운다. */
export type NewPresaleListingInput = Omit<
  PresaleListing,
  "id" | "status" | "liked" | "createdAt"
>;

export type DistrictSummary = {
  sido: Sido;
  sigungu: string;
  listingCount: number;
  totalPremium: Won;
  averagePremium: Won;
  /** 분양가 대비 평균 프리미엄률 */
  averagePremiumRate: number;
};
