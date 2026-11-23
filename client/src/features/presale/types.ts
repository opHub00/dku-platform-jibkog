import type { AiModelInfo } from "./ai/types";

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
  /** 서버 사용자 id(서버 저장소를 쓸 때만 있음) */
  id?: number;
  nickname: string;
  /** 서버는 본인이 아니면 가운데를 가린 이름("김*연")을 준다 */
  realName: string;
  identityVerified: boolean;
  /** 완료된 거래 횟수 */
  tradeCount: number;
};

export type Buyer = {
  nickname: string;
  realName: string;
  identityVerified: boolean;
  /** 완료된 거래 횟수 */
  tradeCount: number;
  /** 구매 희망 최대 예산 */
  maxBudget: Won;
  /** 입주 희망월. "YYYY-MM" */
  desiredMoveInMonth: string;
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

/** review: 신뢰 점수가 낮아 검토 대기(목록에 노출 안 함) */
export type PresaleListingStatus = "selling" | "reserved" | "sold" | "review";

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
  /** 마지막 신뢰 검증 결과. 아직 검증하지 않았으면 없음 */
  trust?: TrustReport;
  /** 로그인한 내가 판매자인 매물이면 true(서버 저장소를 쓸 때만 있음) */
  isMine?: boolean;
};

/** 매물 등록 시 입력값. id·상태·찜·등록시각·검증결과는 저장소가 채운다. */
export type NewPresaleListingInput = Omit<
  PresaleListing,
  "id" | "status" | "liked" | "createdAt" | "trust" | "isMine"
>;

export type TrustItemStatus = "pass" | "warn" | "fail";

/** 판단 근거의 출처 */
export type TrustSource = "ai" | "rule" | "public";

export type TrustItemKey =
  | "identity"
  | "contractComplex"
  | "contractArea"
  | "contractPrice"
  | "contractName"
  | "contractForgery"
  | "documents"
  | "premium"
  | "description"
  | "resale";

export type TrustItem = {
  key: TrustItemKey;
  label: string;
  score: number;
  maxScore: number;
  status: TrustItemStatus;
  description: string;
  source: TrustSource;
};

export type TrustGrade = "매우 안전" | "안전한 편" | "주의 필요" | "위험";

export type TrustReport = {
  /** 상한 적용 후 최종 점수 0~100 */
  score: number;
  /** 항목 합계(상한 적용 전) */
  rawScore: number;
  grade: TrustGrade;
  /** 전매제한 기간이면 false */
  tradable: boolean;
  /** 적용된 점수 상한 설명. 예: "경고 항목이 있어 최대 84점" */
  caps: string[];
  items: TrustItem[];
  /** AI 결과를 하나라도 실제로 받았으면 "live" */
  mode: "live" | "demo";
  /** live일 때 분석한 AI 모델(예: Gemini) */
  analyzedBy?: AiModelInfo;
  evaluatedAt: string;
};

export type DistrictSummary = {
  sido: Sido;
  sigungu: string;
  listingCount: number;
  totalPremium: Won;
  averagePremium: Won;
  /** 분양가 대비 평균 프리미엄률 */
  averagePremiumRate: number;
};
