/**
 * 청약 공고 카탈로그·지도 API의 응답 타입(약속). 문서: docs/api-catalog.md
 *
 * 서버(server/catalog/*)도 이 파일을 상대 경로로 그대로 import한다.
 * 그래서 "@/" 경로 import를 쓰지 않는다. 이 파일을 바꿀 때는 서버·화면 담당이 같이 합의한다.
 *
 * 금액은 모두 원 단위 정수다(청약홈 원본의 만원 단위는 서버가 ×10,000 해서 준다).
 * 날짜는 "YYYY-MM-DD", 월은 "YYYY-MM" 문자열이다(한국 시간 기준).
 */

/** 원 단위 정수 */
export type Won = number;

/** 시·도 짧은 이름. 청약홈 공급지역명(SUBSCRPT_AREA_CODE_NM)과 같다 */
export const CATALOG_REGIONS = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;
export type CatalogRegion = (typeof CATALOG_REGIONS)[number];

/** 위도·경도. 카카오 지도 new kakao.maps.LatLng(lat, lng) 순서와 같다 */
export type LatLng = { lat: number; lng: number };

/**
 * 공고 상태. 서버가 오늘 날짜(한국 시간)로 계산한다.
 * upcoming: 청약 접수 시작 전 / open: 접수 중(시작일~마감일 포함) / closed: 마감 후
 */
export type NoticeStatus = "upcoming" | "open" | "closed";
export const NOTICE_STATUSES: readonly NoticeStatus[] = ["upcoming", "open", "closed"];

// ---------------------------------------------------------------- 주택형

/** 공고의 주택형 하나(청약홈 housing_types[] 한 줄) */
export type HousingType = {
  /** 모델번호. "01", "02" … 매물 등록 때 housingModelNumber로 보낸다 */
  modelNumber: string;
  /** 주택형 코드 원문(앞뒤 공백 제거). 예: "084.9409A" */
  housingTypeCode: string;
  /** 전용면적(㎡). 주택형 코드 앞 숫자. 예: 84.9409 */
  exclusiveAreaM2: number;
  /** 공급면적(㎡). 예: 109.7007 */
  supplyAreaM2: number;
  /** 분양 최고가(원). 청약홈 만원 단위 × 10,000. 예: 1_827_000_000 */
  maxPriceWon: Won;
  /** 일반공급 세대수 */
  generalUnits: number;
  /** 특별공급 세대수 */
  specialUnits: number;
};

// ---------------------------------------------------------------- 공고

/** 청약 공고 하나 */
export type Notice = {
  /** 주택관리번호(청약홈 houseManageNo). 예: "2026000560" */
  id: string;
  /** 공고번호(청약홈 pblancNo) */
  noticeNumber: string;
  /** 이 공고로 만들어진 카탈로그 단지 id */
  complexId: string;
  /** 공고 이름. 예: "해링턴 플레이스 문래" */
  title: string;
  /** 공급 위치 원문. 예: "서울특별시 영등포구 문래동3가 27-1번지 일원" */
  address: string;
  region: CatalogRegion;
  status: NoticeStatus;
  /** 모집공고일 */
  publishedOn: string;
  /** 청약 접수 시작일 */
  applicationsOpenOn: string;
  /** 청약 접수 마감일 */
  applicationsCloseOn: string;
  /** 공급 세대수 */
  totalUnits: number;
  /** 청약홈 공고 상세 주소 */
  noticeUrl: string;
  /** 분양 홈페이지. 없으면 null */
  websiteUrl: string | null;
  /** 카카오 주소 검색으로 찾은 좌표. 못 찾았으면 null(지도 핀 없음) */
  location: LatLng | null;
};

// ---------------------------------------------------------------- 카탈로그 단지

/** 청약 공고에서 온 단지(검색 목록 한 줄) */
export type CatalogComplex = {
  /** 카탈로그 단지 id. 화면은 형식을 가정하지 않는다(지금은 첫 공고의 주택관리번호) */
  id: string;
  name: string;
  /** 공급 위치 원문 */
  address: string;
  region: CatalogRegion;
  /** 시·군·구. 예: "영등포구" */
  sigungu: string;
  location: LatLng | null;
  /** 입주 예정 월 "YYYY-MM". 공고에 없으면 null */
  moveInMonth: string | null;
  totalUnits: number;
  /** 가장 최근 공고 id */
  latestNoticeId: string;
  /** 가장 최근 공고의 상태 */
  latestNoticeStatus: NoticeStatus;
  /** 주택형 분양 최고가 중 가장 낮은 값·높은 값(원) */
  maxPriceRangeWon: { min: Won; max: Won };
  /** 주택형 개수 */
  housingTypeCount: number;
};

/** 단지 상세: 목록 정보 + 주택형 + 공고 */
export type CatalogComplexDetail = CatalogComplex & {
  /** 모델번호 오름차순 */
  housingTypes: HousingType[];
  /** 공고일 최신순 */
  notices: Notice[];
};

// ---------------------------------------------------------------- 지도 핀

/** 분양권 매물 핀(매물 하나당 하나. 같은 단지는 같은 좌표라 화면이 묶어서 보여준다) */
export type ListingMarker = {
  kind: "listing";
  /** 핀 고유 키. "listing-{listingId}" */
  key: string;
  listingId: number;
  /** 매물의 단지 id(GET /api/complexes의 id) */
  complexId: string;
  lat: number;
  lng: number;
  /** 단지 이름 */
  title: string;
  /** 공급면적(㎡) */
  areaM2: number;
  /** 프리미엄(원) */
  premiumWon: Won;
  /** 예시(시드) 매물이면 true */
  isDemo: boolean;
};

/** 청약 공고 핀(좌표가 있는 공고만) */
export type NoticeMarker = {
  kind: "notice";
  /** 핀 고유 키. "notice-{noticeId}" */
  key: string;
  noticeId: string;
  complexId: string;
  lat: number;
  lng: number;
  title: string;
  status: NoticeStatus;
  applicationsOpenOn: string;
  applicationsCloseOn: string;
};

export type MapMarker = ListingMarker | NoticeMarker;

/** 지도에 보이는 영역. 남서쪽(sw)·북동쪽(ne) 꼭짓점 */
export type MapBounds = { swLat: number; swLng: number; neLat: number; neLng: number };

// ---------------------------------------------------------------- 응답 본문

/** GET /api/catalog/complexes */
export type CatalogComplexPage = {
  items: CatalogComplex[];
  /** 1부터 시작 */
  page: number;
  pageSize: number;
  /** 조건에 맞는 전체 개수 */
  total: number;
  hasNext: boolean;
};

/** GET /api/catalog/complexes/:id */
export type CatalogComplexResponse = { complex: CatalogComplexDetail };

/** GET /api/catalog/notices */
export type NoticeListResponse = { notices: Notice[] };

/** GET /api/map/markers */
export type MapMarkersResponse = {
  markers: MapMarker[];
  /** 핀이 너무 많아 MAX_MAP_MARKERS개에서 잘랐으면 true(화면은 "지도를 확대해 주세요" 안내) */
  truncated: boolean;
};

export const CATALOG_PAGE_SIZE = 20;
export const MAX_MAP_MARKERS = 300;

// ---------------------------------------------------------------- 매물 등록 추가 필드

/**
 * POST /api/listings 본문·매물 응답에 더하는 필드.
 * catalogComplexId와 housingModelNumber는 둘 다 보내거나 둘 다 빼야 한다.
 */
export type CatalogListingFields = {
  /** GET /api/catalog/complexes의 id */
  catalogComplexId?: string;
  /** 그 단지 주택형의 modelNumber. 예: "01" */
  housingModelNumber?: string;
};

/** 매물 응답에만 있는 필드(등록 본문에는 보내지 않는다) */
export type ListingDemoFlag = {
  /** 예시(시드) 매물이면 true. 화면은 "예시 매물" 배지를 붙인다 */
  isDemo?: boolean;
};
