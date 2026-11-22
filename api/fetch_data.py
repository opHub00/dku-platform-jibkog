"""청약 공고, 카카오맵 좌표, 아파트 매매 실거래가 조회."""

import argparse
from datetime import date, datetime, timedelta
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


APPLYHOME_URL = (
    "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail"
)
APPLYHOME_MODELS_URL = (
    "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl"
)
KAKAO_URL = "https://dapi.kakao.com/v2/local/search/address.json"
TRADE_URL = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade"


DATA_GO_KR_SERVICE_KEY = "d84d477132471b8e0b3ea5e358327807330015645f43dadde425b5aaa239a8c4"
KAKAO_REST_API_KEY = "75c92c38109e03840543eeeb95685723"


class ApiError(Exception):
    """API 이름과 오류 원인을 키 노출 없이 표시할 수 있는 오류."""


def fetch(url, params, name, headers=None):
    request = Request(f"{url}?{urlencode(params)}", headers=headers or {})
    try:
        with urlopen(request, timeout=15) as response:
            return response.read()
    except HTTPError as error:
        hint = " 키 종류와 API 사용 설정을 확인하세요." if error.code in (400, 401, 403) else ""
        raise ApiError(f"{name} HTTP {error.code}.{hint}") from None
    except (URLError, OSError):
        raise ApiError(f"{name}에 연결하지 못했습니다. 네트워크를 확인하세요.") from None


def json_response(raw, field, name):
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError):
        raise ApiError(f"{name}에서 JSON 응답을 받지 못했습니다.") from None
    rows = payload.get(field) if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
        raise ApiError(f"{name} 응답에 예상한 데이터가 없습니다. 인증키와 API 사용 설정을 확인하세요.")
    return payload, rows


def json_rows(raw, field, name):
    return json_response(raw, field, name)[1]


def fetch_notices(key, region, since, limit, notice_number=None, house_manage_no=None):
    params = {
        "serviceKey": key,
        "page": 1,
        "perPage": limit,
        "returnType": "JSON",
    }
    if notice_number or house_manage_no:
        if notice_number:
            params["cond[PBLANC_NO::EQ]"] = notice_number
        if house_manage_no:
            params["cond[HOUSE_MANAGE_NO::EQ]"] = house_manage_no
    else:
        params["cond[SUBSCRPT_AREA_CODE_NM::EQ]"] = region
        params["cond[RCRIT_PBLANC_DE::GTE]"] = since
    raw = fetch(APPLYHOME_URL, params, "청약홈")
    return [
        {
            "id": row.get("HOUSE_MANAGE_NO"),
            "notice_number": row.get("PBLANC_NO"),
            "title": row.get("HOUSE_NM"),
            "address": row.get("HSSPLY_ADRES"),
            "published_on": row.get("RCRIT_PBLANC_DE"),
            "applications_open": row.get("RCEPT_BGNDE"),
            "applications_close": row.get("RCEPT_ENDDE"),
            "notice_url": row.get("PBLANC_URL"),
            "website_url": row.get("HMPG_ADRES"),
            "coordinates": None,
            "total_units": row.get("TOT_SUPLY_HSHLDCO"),
            "housing_types": None,
            "documents": [],
            "applyhome_raw": row,
        }
        for row in json_rows(raw, "data", "청약홈")
    ]


def fetch_housing_types(key, house_manage_no, notice_number):
    if not house_manage_no or not notice_number:
        raise ApiError("주택관리번호 또는 공고번호가 없어 주택형을 조회할 수 없습니다.")
    params = {
        "serviceKey": key,
        "page": 1,
        "perPage": 100,
        "returnType": "JSON",
        "cond[HOUSE_MANAGE_NO::EQ]": house_manage_no,
        "cond[PBLANC_NO::EQ]": notice_number,
    }
    housing_types = []
    while True:
        raw = fetch(APPLYHOME_MODELS_URL, params, "청약홈 주택형")
        payload, rows = json_response(raw, "data", "청약홈 주택형")
        for row in rows:
            if (
                str(row.get("HOUSE_MANAGE_NO")) != str(house_manage_no)
                or str(row.get("PBLANC_NO")) != str(notice_number)
            ):
                raise ApiError("청약홈 주택형 응답의 공고 식별자가 요청과 다릅니다.")
            housing_types.append({
                "model_number": row.get("MODEL_NO"),
                "housing_type": row.get("HOUSE_TY"),
                "supply_area_m2": row.get("SUPLY_AR"),
                "max_price_krw_10000": row.get("LTTOT_TOP_AMOUNT"),
                "general_supply_units": row.get("SUPLY_HSHLDCO"),
                "special_supply_units": row.get("SPSPLY_HSHLDCO"),
                "special_supply_by_category": {
                    "newlyweds": row.get("NWWDS_HSHLDCO"),
                    "first_time_buyers": row.get("LFE_FRST_HSHLDCO"),
                    "multi_child_households": row.get("MNYCH_HSHLDCO"),
                    "supporting_elderly_parents": row.get("OLD_PARNTS_SUPORT_HSHLDCO"),
                    "institution_recommended": row.get("INSTT_RECOMEND_HSHLDCO"),
                    "relocating_institution_employees": row.get("TRANSR_INSTT_ENFSN_HSHLDCO"),
                    "newborns": row.get("NWBB_HSHLDCO"),
                    "young_adults": row.get("YGMN_HSHLDCO"),
                    "other": row.get("ETC_HSHLDCO"),
                },
                "applyhome_raw": row,
            })
        matched = payload.get("matchCount")
        if len(rows) < params["perPage"] or (isinstance(matched, int) and len(housing_types) >= matched):
            return housing_types
        params["page"] += 1


def fetch_coordinates(key, address):
    query = re.sub(r"\s+(?:일원|일대)\s*$", "", address.strip())
    raw = fetch(
        KAKAO_URL, {"query": query, "size": 1}, "카카오맵",
        {"Authorization": f"KakaoAK {key}"},
    )
    rows = json_rows(raw, "documents", "카카오맵")
    if not rows:
        return None
    try:
        return {
            "latitude": float(rows[0]["y"]),
            "longitude": float(rows[0]["x"]),
            "matched_address": rows[0].get("address_name"),
        }
    except (KeyError, TypeError, ValueError):
        raise ApiError("카카오맵에서 좌표를 읽을 수 없었습니다.") from None


def fetch_trades(key, district, month, limit):
    params = {
        "serviceKey": key, "LAWD_CD": district, "DEAL_YMD": month,
        "pageNo": 1, "numOfRows": limit,
    }
    raw = fetch(TRADE_URL, params, "국토교통부 실거래가")
    try:
        response = ET.fromstring(raw)
    except ET.ParseError:
        raise ApiError("국토교통부에서 XML 응답을 받지 못했습니다.") from None
    code = response.findtext("./header/resultCode") or response.findtext(".//returnReasonCode")
    if code not in ("0", "00", "000"):
        suffix = f" (응답 코드 {code})" if code and re.fullmatch(r"[0-9]{1,4}", code) else ""
        raise ApiError(f"국토교통부 요청에 실패했습니다{suffix}. 키와 활용신청 상태를 확인하세요.")
    return [
        {field.tag: (field.text or "").strip() for field in item}
        for item in response.findall("./body/items/item")[:limit]
    ]


def parse_args():
    today = date.today()
    last_month = today.replace(day=1) - timedelta(days=1)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--house-manage-no", help="특정 청약 주택관리번호로 조회 (지역과 날짜 대신 사용)")
    parser.add_argument("--notice-number", help="특정 청약 공고번호로 조회 (지역과 날짜 대신 사용)")
    parser.add_argument("--region", default="서울", help="청약 공고의 공급지역명 (기본 서울)")
    parser.add_argument("--since", default=(today - timedelta(days=365)).isoformat(),
                        help="모집공고일 하한 YYYY-MM-DD (기본 최근 365일)")
    parser.add_argument("--district", default="11650", help="실거래 법정동 코드 앞 5자리 (기본 서울 서초구)")
    parser.add_argument("--month", default=last_month.strftime("%Y%m"), help="실거래 계약월 YYYYMM (기본 지난달)")
    parser.add_argument("--limit", default=5, type=int, help="공고와 실거래 각각의 최대 조회 건수 (기본 5)")
    args = parser.parse_args()
    try:
        date.fromisoformat(args.since)
        if not re.fullmatch(r"[0-9]{6}", args.month):
            raise ValueError
        datetime.strptime(args.month, "%Y%m")
    except ValueError:
        parser.error("--since는 YYYY-MM-DD, --month는 YYYYMM 형식이어야 합니다.")
    if not re.fullmatch(r"[0-9]{5}", args.district):
        parser.error("--district에는 법정동 코드 앞 5자리를 입력하세요.")
    if not 1 <= args.limit <= 30:
        parser.error("--limit은 1~30 사이의 숫자여야 합니다.")
    return args


def main():
    args = parse_args()
    public_key = unquote(os.environ.get("DATA_GO_KR_SERVICE_KEY", "").strip() or DATA_GO_KR_SERVICE_KEY)
    kakao_key = os.environ.get("KAKAO_REST_API_KEY", "").strip() or KAKAO_REST_API_KEY

    notices = trades = None
    errors = []
    document_index = Path(__file__).with_name("document_sources.json")
    try:
        documents = json.loads(document_index.read_text(encoding="utf-8")) if document_index.exists() else {}
        if not isinstance(documents, dict) or not all(isinstance(items, list) for items in documents.values()):
            raise ValueError
    except (OSError, ValueError):
        errors.append("document_sources.json에서 공고별 문서 목록을 읽지 못했습니다.")
        documents = {}
    try:
        notices = fetch_notices(
            public_key, args.region, args.since, args.limit,
            notice_number=args.notice_number, house_manage_no=args.house_manage_no,
        )
    except ApiError as error:
        errors.append(str(error))

    for notice in notices or []:
        notice_key = f'{notice["id"]}:{notice["notice_number"]}'
        notice["documents"] = documents.get(notice_key, [])
        try:
            notice["housing_types"] = fetch_housing_types(public_key, notice["id"], notice["notice_number"])
        except ApiError as error:
            errors.append(f'{notice["title"] or notice_key}: {error}')

    for notice in notices or []:
        if not notice["address"]:
            continue
        try:
            notice["coordinates"] = fetch_coordinates(kakao_key, notice["address"])
        except ApiError as error:
            errors.append(str(error))
            break

    try:
        trades = fetch_trades(public_key, args.district, args.month, args.limit)
    except ApiError as error:
        errors.append(str(error))

    result = {
        "query": vars(args),
        "notices": notices,
        "apartment_sales": trades,
        "errors": errors,
    }
    output = Path(__file__).with_name("results.json")
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    mapped = sum(notice["coordinates"] is not None for notice in notices or [])
    model_count = sum(len(notice["housing_types"] or []) for notice in notices or [])
    print(
        f"청약 공고 {len(notices or [])}건 · 주택형 {model_count}건 · "
        f"좌표 확인 {mapped}건 · 실거래 {len(trades or [])}건"
    )
    for error in errors:
        print(error, file=sys.stderr)
    print(f"결과 파일 {output}")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
