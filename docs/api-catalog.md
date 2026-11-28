# 청약 카탈로그·지도 API 약속

실제 청약 공고 데이터와 카카오 지도를 붙이기 위해 서버와 화면이 주고받을 약속이다.
서버와 화면을 동시에 만들기 때문에, 이 문서와 타입 파일이 둘 사이의 유일한 기준이다.

- 응답 타입: [client/src/features/catalog/types.ts](../client/src/features/catalog/types.ts). 서버도 이 파일을 상대 경로로 import한다. 그래서 `@/` import를 쓰지 않는다.
- 임시 응답: [server/catalog/fixture.ts](../server/catalog/fixture.ts). 청약 공고 샘플 5개를 담고 있고, 개발 서버(`pnpm dev`)에 이미 연결되어 있다. 화면은 서버 구현을 기다리지 않고 이 응답으로 개발한다.
- 서버 인터페이스: [server/catalog/source.ts](../server/catalog/source.ts)의 `CatalogSource`와 쿼리 파싱 함수. [server/catalog/live.ts](../server/catalog/live.ts)가 수집·캐시를 맡고, 키가 없거나 첫 수집에 실패하면 fixture를 사용한다. 연결 위치는 `server/api/app.ts`다.
- 공통 규칙은 [docs/api.md](api.md)를 따른다. 오류 본문은 `{ error: { code, message } }`이고, 금액은 원 단위 정수다.

## 담당 나누기

서버 담당 파일: server/catalog/*, server/store 시드 / 화면 담당 파일: client/src/features/map/*, client/src/features/catalog/* (types.ts 제외), presale 등록 화면, pages/Listings.tsx

- `client/src/features/catalog/types.ts`와 이 문서는 둘이 함께 쓰는 약속이다. 바꿀 때는 양쪽이 합의하고 같은 커밋에서 함께 고친다.
- `server/api/app.ts`의 카탈로그·지도 라우트 4줄은 서버 담당이 구현을 바꿀 때만 고친다.
- 키 관리: 청약홈·카카오 REST 키는 서버 환경변수(`.env.local`)에만 둔다. 코드, 문서, 응답, 커밋 어디에도 키 문자열을 넣지 않는다. 화면에서 쓰는 카카오 지도 JavaScript 키는 화면 담당이 `VITE_` 환경변수로 따로 받는다.

## 데이터 원천과 변환 규칙

원천은 청약홈 분양정보와 카카오 주소 검색 결과다. 형식은 `api/results.json`의 `notices[]`와 같다(origin/feature/api 브랜치).

| 원본(results.json) | 약속 필드 | 변환 |
|---|---|---|
| `id` (주택관리번호) | `Notice.id`, 지금은 `CatalogComplex.id`로도 씀 | 문자열 그대로 |
| `notice_number` | `Notice.noticeNumber` | 그대로 |
| `title` | `Notice.title`, `CatalogComplex.name` | 그대로 |
| `address` | `address` | 그대로. 두 번째 단어를 `sigungu`로 씀 |
| `applyhome_raw.SUBSCRPT_AREA_CODE_NM` | `region` | "서울", "경기" 같은 시·도 짧은 이름 |
| `applyhome_raw.MVN_PREARNGE_YM` | `moveInMonth` | `"203003"` → `"2030-03"`. 없으면 `null` |
| `published_on` / `applications_open` / `applications_close` | `publishedOn` / `applicationsOpenOn` / `applicationsCloseOn` | `"YYYY-MM-DD"` 그대로 |
| `coordinates.latitude`, `coordinates.longitude` | `location: { lat, lng }` | `coordinates`가 `null`이면 `location: null`이고 지도 핀을 만들지 않음 |
| `total_units` | `totalUnits` | 그대로 |
| `notice_url` / `website_url` | `noticeUrl` / `websiteUrl` | 그대로. 홈페이지가 없으면 `null` |
| `housing_types[].model_number` | `HousingType.modelNumber` | `"01"` 그대로 |
| `housing_types[].housing_type` | `housingTypeCode`, `exclusiveAreaM2` | 앞뒤 공백 제거. 앞 숫자가 전용면적이다. `"084.9409A"`는 84.9409㎡ |
| `housing_types[].supply_area_m2` | `supplyAreaM2` | 문자열을 숫자로 |
| `housing_types[].max_price_krw_10000` | `maxPriceWon` | 만원 단위라 ×10,000. `"182700"`은 1,827,000,000원 |
| `housing_types[].general_supply_units` / `special_supply_units` | `generalUnits` / `specialUnits` | 그대로 |

- 공고 상태 `status`는 저장하지 않고, 응답할 때 오늘 날짜(한국 시간)로 계산한다.
  - `upcoming`: 오늘이 접수 시작일 전
  - `open`: 접수 시작일부터 마감일까지(양 끝 포함)
  - `closed`: 마감일 다음 날부터
- 지금은 공고 하나가 단지 하나다. 같은 단지에 공고가 여러 개(1차, 2차) 생기면 서버가 하나로 묶는다. 이때 단지 `id`는 바뀌지 않아야 한다. 화면은 `id` 형식(숫자 여부 등)을 가정하지 않는다.
- 좌표 순서는 카카오 지도 `new kakao.maps.LatLng(lat, lng)`와 같다. 위도가 먼저 온다.

## 1. 단지 검색 `GET /api/catalog/complexes`

청약 공고에서 온 단지를 이름과 주소로 찾는다. 로그인은 필요 없다.

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `q` | 아니요 | 검색어(최대 50자). 공백과 대소문자를 무시하고, 단지 이름이나 주소에 포함되면 맞는 것으로 본다. 비우면 전체 |
| `region` | 아니요 | 시·도 짧은 이름. `CATALOG_REGIONS` 중 하나(서울, 경기, 인천, 부산 …) |
| `page` | 아니요 | 1부터 시작. 기본 1. 한 쪽은 `CATALOG_PAGE_SIZE`(20)개 |

정렬은 가장 최근 공고일 순이다.

```http
GET /api/catalog/complexes?q=문래&region=서울&page=1
```

200 `CatalogComplexPage`

```json
{
  "items": [
    {
      "id": "2026000560",
      "name": "해링턴 플레이스 문래",
      "address": "서울특별시 영등포구 문래동3가 27-1번지 일원",
      "region": "서울",
      "sigungu": "영등포구",
      "location": { "lat": 37.5189899995753, "lng": 126.900096441767 },
      "moveInMonth": "2030-03",
      "totalUnits": 218,
      "latestNoticeId": "2026000560",
      "latestNoticeStatus": "open",
      "maxPriceRangeWon": { "min": 1775000000, "max": 1827000000 },
      "housingTypeCount": 3
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "hasNext": false
}
```

오류: `q`가 50자를 넘거나, `region`이 목록에 없거나, `page`가 1 미만이거나 정수가 아니면 400 `bad_request`.

## 2. 단지 상세 `GET /api/catalog/complexes/:id`

목록 정보에 주택형 목록과 공고 목록을 더해서 준다. 로그인은 필요 없다. `:id`는 영문, 숫자, `_`, `-`로 된 1~64자다.

200 `CatalogComplexResponse`

```json
{
  "complex": {
    "id": "2026000560",
    "name": "해링턴 플레이스 문래",
    "...": "목록 항목과 같은 필드",
    "housingTypes": [
      {
        "modelNumber": "01",
        "housingTypeCode": "084.9409A",
        "exclusiveAreaM2": 84.9409,
        "supplyAreaM2": 109.7007,
        "maxPriceWon": 1827000000,
        "generalUnits": 51,
        "specialUnits": 59
      }
    ],
    "notices": [
      {
        "id": "2026000560",
        "noticeNumber": "2026000560",
        "complexId": "2026000560",
        "title": "해링턴 플레이스 문래",
        "address": "서울특별시 영등포구 문래동3가 27-1번지 일원",
        "region": "서울",
        "status": "open",
        "publishedOn": "2026-11-13",
        "applicationsOpenOn": "2026-11-23",
        "applicationsCloseOn": "2026-11-26",
        "totalUnits": 218,
        "noticeUrl": "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2026000560&pblancNo=2026000560",
        "websiteUrl": "https://www.해링턴플레이스문래.com",
        "location": { "lat": 37.5189899995753, "lng": 126.900096441767 }
      }
    ]
  }
}
```

- `housingTypes`는 모델번호 오름차순이고, `notices`는 공고일 최신순이다.
- 없는 `id`면 404 `not_found`.

## 3. 공고 목록 `GET /api/catalog/notices`

로그인은 필요 없다.

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `status` | 아니요 | `open`, `upcoming`, `closed` 중 하나. 빼면 전체 |

200 `NoticeListResponse`. 결과는 `{ "notices": Notice[] }`이고 공고일 최신순이다. 지도 핀에 쓰는 좌표는 각 공고의 `location`에 있고, 값이 `null`이면 핀을 만들지 않는다.

```http
GET /api/catalog/notices?status=open
```

오류: `status` 값이 위 셋이 아니면 400 `bad_request`.

## 4. 지도 핀 `GET /api/map/markers`

지도에 보이는 영역 안의 핀을 준다. 분양권 매물 핀과 청약 공고 핀이 함께 온다. 로그인은 필요 없고, 로그인해도 응답은 같다.

| 쿼리 | 필수 | 설명 |
|---|---|---|
| `bounds` | 예 | `swLat,swLng,neLat,neLng`. 카카오 `map.getBounds()`의 남서쪽(`getSouthWest()`)과 북동쪽(`getNorthEast()`) 꼭짓점 |
| `recentDays` | 아니요 | 0~3650 정수. 주면 마감 후 이 일수가 지난 공고 핀은 뺀다(화면은 목록과 같은 14를 보낸다). 빼면 모든 공고 |

```http
GET /api/map/markers?bounds=37.40,126.80,37.70,127.20
```

200 `MapMarkersResponse`

```json
{
  "markers": [
    {
      "kind": "listing",
      "key": "listing-1",
      "listingId": 1,
      "complexId": "catalog-2026000560",
      "lat": 37.5189899995753,
      "lng": 126.900096441767,
      "title": "해링턴 플레이스 문래",
      "areaM2": 109.7007,
      "premiumWon": 320000000,
      "isDemo": true
    },
    {
      "kind": "notice",
      "key": "notice-2026000560",
      "noticeId": "2026000560",
      "complexId": "2026000560",
      "lat": 37.5189899995753,
      "lng": 126.900096441767,
      "title": "해링턴 플레이스 문래",
      "status": "open",
      "applicationsOpenOn": "2026-11-23",
      "applicationsCloseOn": "2026-11-26"
    }
  ],
  "truncated": false
}
```

- `kind`로 두 종류를 구분한다(`ListingMarker | NoticeMarker`). `key`는 두 종류를 통틀어 고유하므로 React key로 쓴다.
- 매물 핀(`listing`)
  - 공개 매물(`selling`, `reserved`)만 준다. 검토 대기와 판매 완료 매물은 빠진다.
  - 매물 하나에 핀 하나다. 좌표는 매물 단지(`GET /api/complexes`) 좌표다. 같은 단지의 매물은 좌표가 같으므로 화면이 묶어서 보여준다.
  - 누르면 `GET /api/listings/:listingId`로 간다. `complexId`는 기존 단지 id다(카탈로그 단지 id가 아니다).
- 공고 핀(`notice`): `location`이 있는 공고만 준다. `complexId`로 `GET /api/catalog/complexes/:id`를 부른다.
- 영역 안 핀이 `MAX_MAP_MARKERS`(300)개보다 많으면 그만큼만 주고 `truncated: true`로 표시한다. 매물 핀을 먼저, 공고 핀은 마감일 최신순으로 남긴다. 이때 화면은 "지도를 확대하면 더 보여요"처럼 안내한다.
- 오류(모두 400 `bad_request`)
  - `recentDays`가 0~3650 정수가 아니다.
  - 숫자가 4개가 아니다.
  - 위도·경도가 범위를 벗어난다.
  - 남서쪽 좌표가 북동쪽 좌표보다 작지 않다.
  - 영역이 위도나 경도 3도보다 넓다.

## 5. 매물 등록 추가 필드 `POST /api/listings`

기존 본문([docs/api.md](api.md))에 카탈로그 단지와 주택형을 고르는 필드를 더한다. 타입은 `CatalogListingFields`이고, `PresaleListing`과 `NewPresaleListingInput`에 이미 합쳐 두었다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `catalogComplexId` | string, 선택 | `GET /api/catalog/complexes`의 `id` |
| `housingModelNumber` | string, 선택 | 그 단지 `housingTypes[].modelNumber`. 예: `"01"` |

```json
{
  "complexId": "catalog-2026000560",
  "catalogComplexId": "2026000560",
  "housingModelNumber": "01",
  "area": 109.7007,
  "floor": 12,
  "salePrice": 1780000000,
  "...": "나머지는 기존과 같음"
}
```

서버 검증 규칙:

- `catalogComplexId`와 `housingModelNumber`는 둘 다 보내거나 둘 다 빼야 한다. 하나만 오면 400이다.
- 없는 카탈로그 단지나 그 단지에 없는 모델번호면 400 "단지 정보를 찾을 수 없어요" / "주택형 정보를 찾을 수 없어요"를 준다.
- 두 필드가 있으면 `area`는 그 주택형의 `supplyAreaM2`와 0.5㎡ 이내여야 한다. `salePrice`는 `maxPriceWon` 이하여야 한다. 최고가보다 싸게 분양받은 층은 있어도 비싸게 분양받은 층은 없기 때문이다.
- 카탈로그 단지로 등록하면 서버가 기존 단지 테이블(`complexes`)에 `catalog-<catalogComplexId>` id로 만들거나 연결한다. 그 id를 `complexId`로 쓴다. 이때 화면은 `complexId`를 비워 보낼 수 있다. 값을 보내면 이 id와 같아야 한다.
- 매물 응답(`GET /api/listings`, `GET /api/listings/:id`, 등록 응답)에는 보낸 두 필드를 그대로 돌려준다.

## 6. 예시 매물 표시 `isDemo`

- 매물 응답(`PresaleListing`)과 매물 핀(`ListingMarker`)에 `isDemo: boolean`을 넣는다. 타입은 `ListingDemoFlag`다.
- 서버가 만든 예시(시드) 매물이면 `true`다. 사용자가 직접 등록한 매물은 `false`다. 이전 저장 파일의 시드 매물은 개발용 시드 계정(`@jibkog.dev`)으로 판별한다.
- 화면은 `true`인 매물에 "예시 매물" 배지(`StatusPill tone="sand"`)를 붙인다.
- 등록 본문에는 보내지 않는다. 보내도 서버가 무시한다.
- 지금 상태
  - 지도 핀 임시 응답에는 들어 있다.
  - `GET /api/listings` 응답에도 들어 있다. 화면은 값이 없으면 `false`로 본다.

## 실제 수집·캐시

- 서버 시작 시 `DATA_GO_KR_SERVICE_KEY`, `KAKAO_REST_API_KEY`를 `.env` 또는 `.env.local`에서 읽는다. 두 키가 모두 있으면 서울·경기·인천의 최근 3년 APT 공고와 각 공고의 주택형을 수집한다. [공공데이터포털 청약홈 분양정보 공식 문서](https://www.data.go.kr/data/15098547/openapi.do)의 `getAPTLttotPblancDetail`에는 `page`, `perPage`, `returnType`, `cond[SUBSCRPT_AREA_CODE_NM::EQ]`, `cond[RCRIT_PBLANC_DE::GTE]`를 보내고, `getAPTLttotPblancMdl`에는 `page`, `perPage`, `returnType`, `cond[HOUSE_MANAGE_NO::EQ]`, `cond[PBLANC_NO::EQ]`를 보낸다. 인증에는 `serviceKey`를 쓴다.
- 주소는 [카카오 로컬 API 공식 문서](https://developers.kakao.com/docs/ko/local/dev-guide)의 `/v2/local/search/address.json`으로 조회한다. 같은 주소의 좌표 또는 조회 결과 없음은 캐시에 기록해 다시 요청하지 않는다.
- 수집 결과는 `.data/catalog.json`에 원자적으로 저장한다. 캐시가 하루 이내면 재사용하고, 갱신이 실패하면 기존 캐시 또는 fixture를 사용한다. 키가 없으면 fixture 5개를 사용한다. 요청은 순차적으로 보내며 최소 간격과 갱신당 청약홈 800회·카카오 2,000회 상한을 둔다. 수집 진행·호출 수·대체 사용 여부를 서버 로그에 남기되 키는 기록하지 않는다.
- 좌표와 최고가가 있는 수집 단지의 주택형에서 최대 40개 예시 매물을 만든다. 분양가는 해당 주택형 최고가, 프리미엄은 지역별 기준 비율을 사용한다. 개발용 판매자 계정에 배정하고 신뢰 리포트를 계산해 저장한다. 재시작해도 같은 카탈로그 단지·모델의 예시 매물은 중복 생성하지 않는다. 수집 후보가 30개 미만이면 가능한 수만 만든다.

## 임시 응답(fixture) 범위

| API | 임시 응답 동작 |
|---|---|
| 단지 검색 | 샘플 5개(해링턴 플레이스 문래, 경희궁 에피트, 중화역 라온프라이빗 센트로, 고덕강일지구 3단지, 브라운스톤 월곡 센트럴) 안에서 검색, 지역 필터, 쪽 나누기 |
| 단지 상세 | 샘플 5개, 주택형 3~20개 |
| 공고 목록 | 샘플 5개. 상태는 오늘 날짜로 계산(2026-11-25 기준 open 2개, closed 3개) |
| 지도 핀 | 공고 핀은 샘플 5개, 매물 핀은 저장소의 실제 공개 매물. 둘 다 영역으로 거른다 |

서버 구현이 끝나면 fixture를 실제 데이터 구현으로 바꾼다. 응답 모양은 바뀌지 않으므로 화면 코드는 고치지 않는다.
