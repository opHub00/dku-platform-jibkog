import unittest
from unittest.mock import patch

from api.document_check import cheking_document as checker
from api.document_check import official_form_layout as layout


class OfficialFormLayoutTest(unittest.TestCase):
    def test_title_tolerates_known_privacy_suffix_but_rejects_instructions(self):
        title = "개인정보 수집·이용 및 제3자 제공 동의서"
        self.assertTrue(layout.matches_title(
            "개인정보 수집･이용 및 제3자 제공 동의서 (임대주택 입주신청자/계약자용)", [title],
        ))
        self.assertFalse(layout.matches_title(title + " 작성 안내", [title]))

    def test_blank_resident_register_fails_single_document_check(self):
        page = "\n".join((
            "■ 주민등록법 시행규칙 [별지 제18호서식]",
            "발급확인번호 :",
            "주 민 등 록 표",
            "(등 본)       이 등본은 원본과 틀림없음을 증명합니다.",
            "세대주 성명(한자)                   사유 및 일자",
        ))
        with patch.object(checker, "extract_pdf_text", return_value=([page], None)):
            result = checker.precheck_pdf("blank.pdf", "resident_register")
        self.assertTrue(result["checks"]["document_type"])
        self.assertEqual(result["status"], "manual_review")
        self.assertIn("populated_content_unconfirmed", result["reasons"])

    def test_explicit_label_in_single_document_requires_populated_value(self):
        for value, status in (("", "manual_review"), ("미작성", "manual_review"), ("가상신청", "checklist_matched")):
            with self.subTest(value=value), patch.object(
                checker, "extract_pdf_text", return_value=([f"가족관계증명서\n성명: {value}"], None),
            ):
                result = checker.precheck_pdf("family.pdf", "family_certificate", required_fields=("성명",))
                self.assertEqual(result["status"], status)

    def test_privacy_signed_rows_and_required_checkmarks(self):
        header = "성명      주민등록번호      관계      서명"
        use = "[필수] 개인정보를 수집·이용하는데 동의하십니까?     동의 √   미동의"
        provide = "[필수] 제3자에게 제공하는데 동의하십니까?     동의 √   미동의"
        signed = f"{header}\n가상신청  000000-0000000  본인  가상신청\n2. 다음 항목\n{use}"
        self.assertEqual(layout.privacy_fields([signed, provide]),
                         {"동의 여부": "동의", "서명한 세대원": "신청자"})
        self.assertNotIn("동의 여부", layout.privacy_fields([signed, use]))
        denied = provide.replace("동의 √   미동의", "동의   미동의 √")
        self.assertEqual(layout.privacy_fields([signed, denied])["동의 여부"], "미동의")
        blank = f"{header}\n    -    본인   (서명 또는 인)\n2. 다음 항목\n{use.replace('√', '')}"
        self.assertEqual(layout.privacy_fields([blank, provide.replace("√", "")]), {})

    def test_financial_disclosure_signer_cannot_be_replaced_by_optional_signature(self):
        header = "\n".join((
            "2. 금융정보 등 제공 동의자",
            " " * 59 + "(서명 또는 인)",
            " " * 73 + "(서명 또는 인)",
        ))
        prefix = "본인  가상신청  0 0 0 0 0 0 0"
        disclosure = prefix.ljust(62) + "가상신청"
        notice_only = prefix.ljust(75) + "가상신청"
        filled = disclosure.ljust(75) + "가상신청"
        self.assertEqual(layout.financial_fields([header + "\n" + filled]),
                         {"동의 여부": "동의", "서명한 세대원": "신청자"})
        self.assertEqual(layout.financial_fields([header + "\n" + notice_only]), {})
        self.assertEqual(layout.financial_fields([header]), {})

    def test_asset_amount_belongs_to_the_checked_category(self):
        rows = [
            "신 성 명   가 상 신 청   앞자리",
            "무주택세대구성원 보유 자산",
            "임차보증금 예 þ",
            "주소 내역   1,000,000 원 [임차인]",
            "분양권 예 □",
            "다른 금액   5,000,000 원 [수분양자]",
            "1. 상기 본인",
            "신청인 : 가 상 신 청  가상신청(인)",
        ]
        filled = layout.asset_fields(["\n".join(rows)])
        self.assertEqual(filled["금액"], "1,000,000원")
        self.assertEqual(filled["신청자 서명"], "가상신청")
        rows[3] = "주소 내역      원 [임차인]"
        self.assertNotIn("금액", layout.asset_fields(["\n".join(rows)]))
        rows[-1] = "신청인 : 가 상 신 청 (인)"
        self.assertNotIn("신청자 서명", layout.asset_fields(["\n".join(rows)]))


if __name__ == "__main__":
    unittest.main()
