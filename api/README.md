# 사용 API
1. 카카오톡 Rest API
키: KAKAO_REST_API_KEY
용도: Python에서 지번·도로명 주소를 위도·경도로 변환
2. 카카오톡 JavaScript
키: DATA_GO_KR_SERVICE_KEY
용도: 웹 화면에 카카오 지도를 띄우고 좌표에 핀을 표시할 때 사용
3. [개발계정]한국부동산원_청약홈 분양정보 조회 서비스
키: d84d477132471b8e0b3ea5e358327807330015645f43dadde425b5aaa239a8c4
용도: 청약 공고와 주택형별 공급 세대수·분양가 조회
4. [개발계정]국토교통부_아파트 매매 실거래가 자료
키: 청약홈과 동일
용도: 시군구와 계약월을 기준으로 거래금액·계약일·면적·층 조회


# 집콕 API 조회 예제

청약홈 APT 공고를 조회하고 카카오맵에서 공고 주소의 좌표를 찾습니다. 국토교통부 아파트 매매 실거래가는 시군구와 계약월로 조회합니다.

## 실행

이 폴더에서 PowerShell을 열고 다음 명령을 실행하세요. Python 3.10 이상과 인터넷 연결이 필요합니다. 별도로 설치할 Python 패키지는 없습니다.

```powershell
python fetch_data.py
```

프로그램에 설정된 공공데이터포털 일반 인증키와 카카오 REST API 키를 사용합니다. 명령을 실행하면 바로 조회하고 같은 폴더에 `results.json`을 저장합니다. 결과 파일에는 키를 저장하지 않습니다.

다른 키를 사용하려면 `DATA_GO_KR_SERVICE_KEY`와 `KAKAO_REST_API_KEY` 환경변수를 설정하세요. 환경변수에 값이 있으면 프로그램의 기본 키보다 먼저 사용합니다.

## 조회 조건 바꾸기

기본으로 서울의 최근 365일 APT 공고 첫 페이지와 지난달 서울 서초구 매매 거래 첫 페이지를 각 최대 5건 조회합니다. 공고의 공급지역명과 실거래가의 시군구 코드는 각각 설정합니다.

```powershell
python fetch_data.py --region 서울 --since 2026-01-01 --district 11650 --month 202610 --limit 5
python fetch_data.py --house-manage-no 2026000560 --notice-number 2026000560 --limit 1
python fetch_data.py --help
```

## 지도에 사용하는 데이터

청약 공고 위치를 표시하려면 한 공고의 `coordinates.latitude`와 `coordinates.longitude`를 사용하세요. `title`, `address`, `applications_open`, `applications_close`, `total_units`는 핀을 눌렀을 때 보여줄 수 있습니다. `coordinates`가 `null`인 공고는 위치를 확인하기 전까지 지도 핀을 건너뜁니다. 웹 화면에서는 지도 SDK를 연결하고 결과 JSON을 읽어야 합니다. 카카오맵 SDK의 `LatLng`에는 위도, 경도 순으로 넘깁니다. [카카오 지도 Web SDK 가이드](https://apis.map.kakao.com/web/guide/)

실거래 데이터에는 좌표가 없습니다. 실거래도 지도에 표시하려면 `sggCd`를 시군구 이름으로 변환한 뒤 `umdNm`, `jibun`으로 주소를 구성하고 별도로 좌표를 찾아야 합니다. 현재 거래와 청약 공고의 연결 정보도 없습니다.

## results.json 필드

아래 표는 현재 저장된 JSON에 필드가 나타나는 순서를 따릅니다. 중첩 객체와 배열은 부모 항목 바로 다음에 이어집니다. 프로그램은 필드 이름으로 값을 읽습니다.

- 공고와 주택형의 `applyhome_raw`는 청약홈의 원본 응답 행입니다. 바깥의 소문자 필드는 조회기가 사용하기 쉽게 붙인 이름입니다.
- `null`은 원본에 값이 없거나 해당 데이터를 확보하지 못했다는 뜻입니다. `0`은 API가 제공한 실제 수치이며, `[]`는 조회 결과 또는 등록 목록이 비어 있다는 뜻입니다.
- 공고 번호, 코드, 우편번호, 모델번호는 앞자리 0을 보존하도록 문자열로 다룹니다. 실거래 필드는 XML에서 읽은 문자열이고, 값이 없는 XML 요소는 빈 문자열로 저장합니다.
- 한 API 호출이 실패해도 다른 API가 반환한 데이터는 저장됩니다.
- `documents`는 `document_sources.json`에서 `주택관리번호:공고번호`를 기준으로 붙인 목록입니다.

### 최상위

| 필드 | 의미 |
|---|---|
| `query` | 이번 실행의 조회 조건 |
| `notices` | 청약 공고 목록. 조회 실패 시 null |
| `apartment_sales` | 시군구와 계약월로 조회한 아파트 매매 실거래 목록. 조회 실패 시 null |
| `errors` | 조회 중 발생한 오류 메시지 목록 |

### `query`

| 필드 | 의미 |
|---|---|
| `house_manage_no` | 특정 공고를 조회할 때 입력한 주택관리번호 |
| `notice_number` | 특정 공고를 조회할 때 입력한 공고번호 |
| `region` | 청약 공고의 공급지역명. 예시 서울 |
| `since` | 모집공고일의 하한. YYYY-MM-DD |
| `district` | 실거래 조회용 법정동 코드 앞 5자리. 예시 11650은 서울 서초구 |
| `month` | 실거래 계약월. YYYYMM |
| `limit` | 청약 공고 및 실거래 각각의 최대 조회 건수. 공고별 주택형 수에는 적용되지 않음 |

### 공급 지역 입력
지역: 지역코드(본 프로그램에선 지역명은 쓸 필요 없음!)

서울: 100
강원: 200
대전: 300
충남: 312
세종: 338
충북: 360
인천: 400
경기: 410
광주: 500
전남: 513
전북: 560
부산: 600
경남: 621
울산: 680
제주: 690
대구: 700
경북: 712

### `notices[]`

| 필드 | 의미 |
|---|---|
| `id` | 청약홈 주택관리번호 |
| `notice_number` | 청약홈 공고번호 |
| `title` | 공고의 주택명 |
| `address` | 공고에 적힌 공급 위치 |
| `published_on` | 모집공고일 |
| `applications_open` | 청약 접수 시작일 |
| `applications_close` | 청약 접수 종료일 |
| `notice_url` | 청약홈 공고 상세 페이지 주소 |
| `website_url` | 공고에 등록된 분양 홈페이지 주소 |
| `coordinates` | 카카오맵에서 찾은 위치. 주소가 없거나 좌표를 확보하지 못하면 null |
| `total_units` | 공고 전체 공급 세대수 |
| `housing_types` | 해당 공고의 주택형별 상세 목록. 조회 실패 시 null, 조회 결과가 없으면 빈 배열 |
| `documents` | 등록된 문서 출처 목록. 등록된 문서가 없으면 빈 배열 |
| `applyhome_raw` | 청약홈 공고 기본정보 응답 행 전체 |

### `notices[].coordinates`

| 필드 | 의미 |
|---|---|
| `latitude` | 위도. WGS84 십진수 숫자 |
| `longitude` | 경도. WGS84 십진수 숫자 |
| `matched_address` | 카카오맵 검색 결과가 돌려준 주소 |

### `notices[].housing_types[]`

| 필드 | 의미 |
|---|---|
| `model_number` | 공고 내 모델번호. 예시 01 |
| `housing_type` | 공고상 주택형 코드. 예시 084.9409A |
| `supply_area_m2` | 주택공급면적. ㎡. API의 문자열 형식을 유지 |
| `max_price_krw_10000` | 해당 주택형의 분양 최고금액. 만 원. API의 문자열 형식을 유지 |
| `general_supply_units` | 일반공급 세대수 |
| `special_supply_units` | 특별공급 전체 세대수 |
| `special_supply_by_category` | 특별공급 유형별 배정 세대수 |
| `applyhome_raw` | 청약홈 주택형 상세 응답 행 전체 |

### `notices[].housing_types[].special_supply_by_category`

| 필드 | 의미 |
|---|---|
| `newlyweds` | 신혼부부 |
| `first_time_buyers` | 생애최초 |
| `multi_child_households` | 다자녀가구 |
| `supporting_elderly_parents` | 노부모부양 |
| `institution_recommended` | 기관추천 |
| `relocating_institution_employees` | 이전기관 |
| `newborns` | 신생아 |
| `young_adults` | 청년 |
| `other` | 기타 |

### `notices[].housing_types[].applyhome_raw`

| 필드 | 의미 |
|---|---|
| `ETC_HSHLDCO` | 기타 특별공급 세대수 |
| `HOUSE_MANAGE_NO` | 주택관리번호 |
| `HOUSE_TY` | 공고상 주택형 코드 |
| `INSTT_RECOMEND_HSHLDCO` | 기관추천 특별공급 세대수 |
| `LFE_FRST_HSHLDCO` | 생애최초 특별공급 세대수 |
| `LTTOT_TOP_AMOUNT` | 분양 최고금액. 만 원 |
| `MNYCH_HSHLDCO` | 다자녀가구 특별공급 세대수 |
| `MODEL_NO` | 모델번호 |
| `NWBB_HSHLDCO` | 신생아 특별공급 세대수 |
| `NWWDS_HSHLDCO` | 신혼부부 특별공급 세대수 |
| `OLD_PARNTS_SUPORT_HSHLDCO` | 노부모부양 특별공급 세대수 |
| `PBLANC_NO` | 공고번호 |
| `SPSPLY_HSHLDCO` | 특별공급 전체 세대수 |
| `SUPLY_AR` | 주택공급면적. ㎡ |
| `SUPLY_HSHLDCO` | 일반공급 세대수 |
| `TRANSR_INSTT_ENFSN_HSHLDCO` | 이전기관 특별공급 세대수 |
| `YGMN_HSHLDCO` | 청년 특별공급 세대수 |

### `notices[].documents[]`

| 필드 | 의미 |
|---|---|
| `kind` | 문서 종류. 예시 recruitment_notice_pdf는 입주자모집공고 PDF |
| `url` | 등록한 문서의 직접 주소 |
| `source` | 문서 출처 구분. 예시 published_notice_copy는 게시된 공고문 사본 |
| `verified_by` | 링크의 확인 방식. 예시 manual은 수동 확인 |
| `title` | 문서 제목 |

### `notices[].applyhome_raw`

| 필드 | 의미 |
|---|---|
| `BSNS_MBY_NM` | 사업주체명 또는 시행사 이름 |
| `CNSTRCT_ENTRPS_NM` | 시공사 이름 |
| `CNTRCT_CNCLS_BGNDE` | 계약 시작일 |
| `CNTRCT_CNCLS_ENDDE` | 계약 종료일 |
| `GNRL_RNK1_CRSPAREA_ENDDE` | 일반공급 1순위 해당지역 접수 종료일 |
| `GNRL_RNK1_CRSPAREA_RCPTDE` | 일반공급 1순위 해당지역 접수 시작일 |
| `GNRL_RNK1_ETC_AREA_ENDDE` | 일반공급 1순위 기타지역 접수 종료일 |
| `GNRL_RNK1_ETC_AREA_RCPTDE` | 일반공급 1순위 기타지역 접수 시작일 |
| `GNRL_RNK1_ETC_GG_ENDDE` | 일반공급 1순위 경기지역 구분 접수 종료일 |
| `GNRL_RNK1_ETC_GG_RCPTDE` | 일반공급 1순위 경기지역 구분 접수 시작일 |
| `GNRL_RNK2_CRSPAREA_ENDDE` | 일반공급 2순위 해당지역 접수 종료일 |
| `GNRL_RNK2_CRSPAREA_RCPTDE` | 일반공급 2순위 해당지역 접수 시작일 |
| `GNRL_RNK2_ETC_AREA_ENDDE` | 일반공급 2순위 기타지역 접수 종료일 |
| `GNRL_RNK2_ETC_AREA_RCPTDE` | 일반공급 2순위 기타지역 접수 시작일 |
| `GNRL_RNK2_ETC_GG_ENDDE` | 일반공급 2순위 경기지역 구분 접수 종료일 |
| `GNRL_RNK2_ETC_GG_RCPTDE` | 일반공급 2순위 경기지역 구분 접수 시작일 |
| `HMPG_ADRES` | 분양 홈페이지 주소 |
| `HOUSE_DTL_SECD` | 주택 상세 구분 코드 |
| `HOUSE_DTL_SECD_NM` | 주택 상세 구분명. 예시 민영 |
| `HOUSE_MANAGE_NO` | 주택관리번호 |
| `HOUSE_NM` | 공고의 주택명 |
| `HOUSE_SECD` | 주택 구분 코드 |
| `HOUSE_SECD_NM` | 주택 구분명. 예시 APT |
| `HSSPLY_ADRES` | 공급 위치 주소 |
| `HSSPLY_ZIP` | 공급 위치 우편번호 |
| `IMPRMN_BSNS_AT` | 정비사업 여부 |
| `LRSCL_BLDLND_AT` | 대규모 택지개발지구 여부 |
| `MDAT_TRGET_AREA_SECD` | 조정대상지역 구분 코드 |
| `MDHS_TELNO` | 분양 문의 전화번호 |
| `MVN_PREARNGE_YM` | 입주 예정 연월. YYYYMM |
| `NPLN_PRVOPR_PUBLIC_HOUSE_AT` | 수도권 내 민영 공공주택지구 여부 |
| `NSPRC_NM` | 모집공고를 게재한 신문명 |
| `PARCPRC_ULS_AT` | 분양가상한제 적용 여부 |
| `PBLANC_NO` | 공고번호 |
| `PBLANC_URL` | 청약홈 공고 상세 페이지 주소 |
| `PRZWNER_PRESNATN_DE` | 당첨자 발표일 |
| `PUBLIC_HOUSE_EARTH_AT` | 공공주택지구 여부 |
| `PUBLIC_HOUSE_SPCLW_APPLC_AT` | 공공주택 특별법 적용 여부로 추정되는 Y/N 필드. 공개 명세에서 정의 미확인 |
| `RCEPT_BGNDE` | 청약 접수 시작일 |
| `RCEPT_ENDDE` | 청약 접수 종료일 |
| `RCRIT_PBLANC_DE` | 입주자 모집공고일 |
| `RENT_SECD` | 분양 구분 코드 |
| `RENT_SECD_NM` | 분양 구분명. 예시 분양주택 |
| `SPECLT_RDN_EARTH_AT` | 투기과열지구 여부 |
| `SPSPLY_RCEPT_BGNDE` | 특별공급 접수 시작일 |
| `SPSPLY_RCEPT_ENDDE` | 특별공급 접수 종료일 |
| `SUBSCRPT_AREA_CODE` | 공급지역 코드 |
| `SUBSCRPT_AREA_CODE_NM` | 공급지역명 |
| `TOT_SUPLY_HSHLDCO` | 공고 전체 공급 세대수 |

### `apartment_sales[]`

| 필드 | 의미 |
|---|---|
| `aptDong` | 아파트 동 정보. 공개되지 않은 경우 빈 문자열 |
| `aptNm` | 아파트 이름 |
| `buildYear` | 건축 연도 |
| `buyerGbn` | 매수자 구분. 예시 개인 |
| `cdealDay` | 거래 해제일 |
| `cdealType` | 거래 해제 여부 또는 해제 구분 |
| `dealAmount` | 거래금액. 만 원. 쉼표가 포함될 수 있음 |
| `dealDay` | 계약 일 |
| `dealMonth` | 계약 월 |
| `dealYear` | 계약 연도 |
| `dealingGbn` | 거래 유형. 예시 중개거래, 직거래 |
| `estateAgentSggNm` | 중개사 소재지 시군구명 |
| `excluUseAr` | 전용면적. ㎡ |
| `floor` | 거래 주택의 층 |
| `jibun` | 지번 |
| `landLeaseholdGbn` | 토지임대부 주택 여부 |
| `rgstDate` | 등기일 |
| `sggCd` | 시군구 코드. 법정동 코드 앞 5자리 |
| `slerGbn` | 매도자 구분. 예시 개인 |
| `umdNm` | 법정 읍면동 이름 |

### `errors[]`

각 항목은 조회 중 발생한 오류 메시지 문자열입니다.

공식 문서 [청약홈 분양정보](https://www.data.go.kr/data/15098547/openapi.do) · [카카오맵 REST API](https://developers.kakao.com/docs/ko/kakaomap/rest-api) · [아파트 매매 실거래가](https://www.data.go.kr/data/15126469/openapi.do)
