"""Map known Korean public forms to checklist values using PDF text layout."""

import re
import unicodedata


CERTIFICATE_SUFFIXES = ("", "(상세)", "(일반)", "(특정)")
PRIVACY_USAGE_SUFFIX = "(임대주택입주신청자/계약자용)"
CHECK_MARKS = "√✓✔☑☒þ■"
NAME = r"[가-힣]{2,12}"
ROLES = ("본인", "신청자", "배우자", "자녀", "부", "모")
ASSET_HOLDERS = {
    "임차보증금": "임차인",
    "분양권": "수분양자",
    "비상장주식": "주주",
    "출자금/": "출자자",
    "임대보증금": "임대인",
}


def compact(text):
    return "".join(unicodedata.normalize("NFKC", text).split())


def title_key(text):
    return compact(text).replace("・", "·").replace("･", "·")


def header_titles(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()][:6]
    keys = [title_key(line) for line in lines]
    titles = set(keys)
    for index, (first, second) in enumerate(zip(keys, keys[1:])):
        titles.add(first + second)
        if first == "주민등록표":
            # The certificate subtype can share a row with a separate certification paragraph.
            subtype = re.match(r"^\(\s*(등\s*본|초\s*본)\s*\)(?=\s{2,}|$)", lines[index + 1])
            if subtype:
                titles.add(first + f"({compact(subtype[1])})")
    return titles


def matches_title(text, titles):
    headers = header_titles(text)
    for title in titles:
        key = title_key(title)
        accepted = {key + suffix for suffix in CERTIFICATE_SUFFIXES}
        if key == "개인정보수집·이용및제3자제공동의서":
            accepted.add(key + PRIVACY_USAGE_SUFFIX)
        if headers & accepted:
            return True
    return False


def head_of_household(text):
    for line in text.splitlines():
        match = re.fullmatch(
            rf"세대주성명(?:\(한자\))?({NAME})",
            compact(line).removesuffix("사유및일자").removesuffix("세대구성"),
        )
        if match:
            return match[1]
    return None


def role_name(role):
    return "신청자" if role == "본인" else role


def privacy_fields(pages):
    lines = pages[0].splitlines()
    start = next((i for i, line in enumerate(lines) if "성명주민등록번호관계서명" in compact(line)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if compact(lines[i]).startswith("2.")), len(lines))
    signed = set()
    signature_row = re.compile(
        rf"(?P<name>{NAME})\s+[0-9]{{6}}\s*-\s*[0-9]{{7}}\s+"
        rf"(?P<role>{'|'.join(ROLES)})\s+(?P=name)(?=\s|$)"
    )
    for line in lines[start + 1:end]:
        signed.update(role_name(match["role"]) for match in signature_row.finditer(line))

    answers = {}
    for page in pages:
        questions = [compact(line) for line in page.splitlines() if line.strip()]
        for index, line in enumerate(questions):
            if "동의하십니까?" not in line:
                continue
            tags = re.findall(r"\[(필수|선택)\]", "".join(questions[max(0, index - 3):index + 1]))
            if not tags or tags[-1] != "필수":
                continue
            question = title_key(line.split("동의하십니까?", 1)[0])
            if "수집·이용" in question:
                purpose = "collection"
            elif "제3자에게제공" in question:
                purpose = "third_party"
            else:
                continue
            choices = re.search(r"동의([^가-힣]*)미동의([^가-힣]*)$", line)
            yes = choices is not None and any(mark in choices[1] for mark in CHECK_MARKS)
            no = choices is not None and any(mark in choices[2] for mark in CHECK_MARKS)
            choice = "미동의" if no else "동의" if yes else None
            answers.setdefault(purpose, set()).add(choice)

    values = {}
    if any("미동의" in choices for choices in answers.values()):
        values["동의 여부"] = "미동의"
    elif answers == {"collection": {"동의"}, "third_party": {"동의"}}:
        values["동의 여부"] = "동의"
    if signed:
        values["서명한 세대원"] = ", ".join(sorted(signed))
    return values


def financial_fields(pages):
    lines = pages[0].splitlines()
    start = next((i for i, line in enumerate(lines) if compact(line).startswith("2.금융정보등제공동의자")), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if compact(lines[i]).startswith("3.")), len(lines))
    # The two signature columns have distinct meanings. Only the first records consent to disclose.
    headings = [(index, match.start()) for index in range(start + 1, min(start + 9, end))
                for match in re.finditer(r"\(\s*서명\s*또는\s*인\s*\)", lines[index])]
    if len(headings) != 2 or headings[0][1] >= headings[1][1]:
        return {}
    first, second = headings[0][1], headings[1][1]
    left, right = max(0, first - 5), (first + second) / 2
    signature_row = re.compile(
        rf"^\s*(?P<role>{'|'.join(ROLES)})\s+(?P<name>{NAME})\s+"
        rf"(?:[0-9]\s*){{7}}(?P<signature>(?P=name))(?=\s|$)"
    )
    signed = set()
    for line in lines[headings[1][0] + 1:end]:
        match = signature_row.match(line)
        if match and left <= match.start("signature") < right:
            signed.add(role_name(match["role"]))
    if not signed:
        return {}
    return {"동의 여부": "동의", "서명한 세대원": ", ".join(sorted(signed))}


def asset_fields(pages):
    lines = [compact(line) for line in pages[0].splitlines()]
    if not any("무주택세대구성원보유자산" in line for line in lines):
        return None
    values = {}
    for line in lines:
        name = re.match(rf"^신?성명({NAME})앞자리", line)
        if name:
            values["신청자 성명"] = name[1]
            break
    if "신청자 성명" in values:
        name = values["신청자 성명"]
        if any(line == f"신청인:{name}{name}(인)" or line == f"신청인:{name}{name}(서명)" for line in lines):
            values["신청자 서명"] = name

    section = lines[:next((i for i, line in enumerate(lines) if line.startswith("1.상기")), len(lines))]
    selected = {
        kind: holder for kind, holder in ASSET_HOLDERS.items()
        if any(re.match(re.escape(kind) + rf"예[{CHECK_MARKS}]", line) for line in section)
    }
    if selected:
        values["자산 종류"] = ", ".join("출자금/출자지분" if kind == "출자금/" else kind for kind in selected)
        amounts = [
            [match[1] for line in section for match in
             re.finditer(rf"(?<![\d.,])([0-9]+(?:,[0-9]{{3}})*)원(?=\[{holder})", line)]
            for holder in selected.values()
        ]
        if all(amounts):
            values["금액"] = ", ".join(amount + "원" for group in amounts for amount in group)
    return values


FORM_READERS = {"privacy": privacy_fields, "financial": financial_fields, "asset": asset_fields}


def checklist_pages(document_type, pages):
    reader = FORM_READERS.get(document_type)
    values = reader(pages) if reader else None
    if values is None:
        return pages
    return ["\n".join(f"{label}: {value}" for label, value in values.items())]
