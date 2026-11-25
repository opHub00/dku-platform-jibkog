import json
import unittest
from copy import deepcopy
from datetime import date
from functools import partial
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

from api.document_check import cheking_document as checker


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "test_document"
A17 = "2026820010"
BIRTH_DATE = date(1990, 1, 1)
VISA = "applicant_visa"
FOREIGN_PROFILE = "foreign_first_priority"


class NoticeChecklistTest(unittest.TestCase):
    def setUp(self):
        self.base = json.loads((ROOT / "base_checklist.json").read_text(encoding="utf-8"))
        self.registry = json.loads((ROOT / "noticed_checklist.json").read_text(encoding="utf-8"))
        self.foreign = self.registry["notices"][1]
        self.foreign_url = self.foreign["urls"][0]

    def foreign_rules(self, profile=FOREIGN_PROFILE):
        rules, _ = checker.select_notice_rules(
            self.base, self.registry, url=self.foreign_url, profile_name=profile,
        )
        checker.validate_checklist(rules, ())
        return rules

    def synthetic_bundle(self, rules, submitted, *, ai=None):
        def extract(path):
            if path.stem not in submitted:
                return [], "missing_pdf"
            kind = rules["required"][path.stem]
            document = rules["documents"][kind]
            rows = [document["title"], *(
                f'{field["label"]}: 가상 예시 값' for field in document["fields"].values()
            )]
            return ["\n".join(rows)], None

        with patch.object(checker, "extract_pdf_text", side_effect=extract):
            return checker.check_bundle(FIXTURES, rules, ai=ai)

    @staticmethod
    def failed_slots(report):
        return {doc["slot"] for doc in report["documents"] if doc["status"] == "needs_review"}

    def test_base_has_no_notice_dates_or_required_documents(self):
        self.assertEqual(self.base["required"], {})
        self.assertEqual(self.base["required_signers"], [])
        self.assertNotIn("notice_date", self.base)
        self.assertNotIn("2026-09-30", json.dumps(self.base))
        self.assertNotIn("1990-01-01", json.dumps(self.base))

    def test_a17_real_fixtures_still_check_all_fields(self):
        rules, _ = checker.select_notice_rules(
            self.base, self.registry, number=A17, profile_name="separate_households", birth_date=BIRTH_DATE,
        )
        checker.validate_checklist(rules, ())
        complete = checker.check_bundle(FIXTURES / "complete", rules)
        review = checker.check_bundle(FIXTURES / "needs_review", rules)
        self.assertEqual(complete["status"], "checklist_matched")
        self.assertEqual(len(complete["documents"]), 9)
        self.assertEqual(review["status"], "manual_review")
        self.assertEqual(self.failed_slots(review), {
            "applicant_register", "financial_consent", "family_certificate", "immigration_record",
        })

    def test_a17_common_and_variant_slots(self):
        def slots(profile):
            return checker.select_notice_rules(
                self.base, self.registry, number=A17, profile_name=profile,
            )[0]["required"].keys()

        self.assertEqual(slots("separate_households") - slots("same_household"),
                         {"spouse_register", "family_certificate"})
        self.assertEqual(slots("lease_deposit") - slots("separate_households"), {"asset", "lease"})
        self.assertNotIn(VISA, slots("separate_households"))

    def test_actual_foreign_notice_needs_visa_plus_four_other_documents(self):
        rules = self.foreign_rules()
        common = {"applicant_passport", "foreign_registration_certificate",
                  "foreign_registration_card", "contract_payment"}
        self.assertEqual(rules["required"].keys(), common | {VISA})
        scenarios = [
            (common, {VISA}, "manual_review"),
            ({VISA}, common, "manual_review"),
            (common | {VISA}, set(), "checklist_matched"),
        ]
        for submitted, missing, status in scenarios:
            with self.subTest(submitted=submitted):
                report = self.synthetic_bundle(rules, submitted)
                self.assertEqual(report["status"], status)
                self.assertEqual(self.failed_slots(report), missing)

    def test_hypothetical_worker_condition_is_added_only_for_worker_profile(self):
        # The historical notice has no ordinary applicant profile. Use an isolated synthetic notice.
        self.foreign["profiles"] = {"ordinary": {}, "worker": {"add_required": {VISA: "visa"}}}
        ordinary = self.foreign_rules("ordinary")
        common = set(ordinary["required"])
        worker = self.foreign_rules("worker")
        self.assertEqual(self.synthetic_bundle(ordinary, common)["status"], "checklist_matched")
        self.assertEqual(self.failed_slots(self.synthetic_bundle(worker, common)), {VISA})
        self.assertEqual(self.synthetic_bundle(worker, common | {VISA})["status"], "checklist_matched")

    def test_profile_cannot_erase_all_common_docs(self):
        self.foreign["profiles"][FOREIGN_PROFILE]["remove_required"] = list(self.foreign["common"]["add_required"])
        with self.assertRaises(ValueError):
            self.foreign_rules()

    def test_profile_cannot_supply_only_an_addition_without_common_docs(self):
        del self.foreign["common"]["add_required"]
        with self.assertRaises(ValueError):
            self.foreign_rules()

    def test_profile_cannot_silently_replace_a_common_slot(self):
        self.foreign["profiles"][FOREIGN_PROFILE]["add_required"]["applicant_passport"] = "visa"
        with self.assertRaises(ValueError):
            self.foreign_rules()

    def test_profile_field_patch_preserves_unrelated_fields_and_base(self):
        original = deepcopy(self.base)
        change = {"label": "유효기간", "check": "date"}
        self.foreign["profiles"][FOREIGN_PROFILE]["documents"] = {
            "visa": {"fields": {"valid_until": change}},
        }
        fields = self.foreign_rules()["documents"]["visa"]["fields"]
        self.assertEqual(fields.keys(), {"name", "status", "valid_until"})
        self.assertEqual(self.base, original)

    def test_unknown_notice_and_missing_profile_do_not_fall_back(self):
        for options in (
            {"number": A17},
            {"url": self.foreign_url},
            {"number": "0000000000", "profile_name": "fake"},
        ):
            with self.subTest(options=options), self.assertRaises(ValueError):
                checker.select_notice_rules(self.base, self.registry, **options)

    def test_birth_date_and_notice_date_are_resolved_separately(self):
        for birth_date, expected in ((date(1955, 1, 1), "1961-01-01"), (BIRTH_DATE, "1990-01-01")):
            rules, _ = checker.select_notice_rules(
                self.base, self.registry, number=A17, profile_name="same_household", birth_date=birth_date,
            )
            fields = rules["documents"]["immigration"]["fields"]
            self.assertEqual(checker.resolve_field_argument(fields["start"], rules), expected)
            self.assertEqual(checker.resolve_field_argument(fields["end"], rules), "2026-09-30")

    def test_non_demo_folder_requires_notice_instead_of_borrowing_demo_rules(self):
        with patch.object(checker, "write_report") as write:
            self.assertEqual(checker.run_batch([str(FIXTURES / "optional")]), 1)
            report = write.call_args.args[0]
            self.assertEqual(report["status"], "rules_unavailable")
            self.assertIsNone(report["failed_document_count"])

    def test_no_selector_is_marked_demo_but_explicit_a17_needs_applicant_birth_date(self):
        with patch.object(checker, "write_report") as write:
            self.assertEqual(checker.run_batch([str(FIXTURES / "complete")]), 0)
            self.assertTrue(write.call_args.args[0]["notice"]["demo"])
            self.assertEqual(checker.run_batch([
                str(FIXTURES / "complete"), "--notice-number", A17, "--profile", "same_household",
            ]), 1)
            self.assertEqual(write.call_args.args[0]["status"], "rules_unavailable")
            self.assertIn("--birth-date", write.call_args.args[0]["message"])

    @staticmethod
    def http_error(code):
        return HTTPError("https://example.invalid/", code, "", None, None)

    @staticmethod
    def mock_evidence(document):
        return {(document["slot"], key): [f"{label}: 가상 예시 값"]
                for key, label in document["fields"].items()}

    def test_retries_same_model_before_switching(self):
        models = list(checker.GEMINI_MODELS)
        responses = [self.http_error(503) for _ in range(2)] + [{}]
        with patch.object(checker, "gemini_evidence", side_effect=responses) as call, patch.object(checker, "sleep") as wait:
            evidence = checker.gemini_evidence_with_fallback("test", models[0], [])
        self.assertEqual(evidence, {})
        self.assertEqual([item.args[1] for item in call.call_args_list], models[:1] * 3)
        self.assertEqual([item.args[0] for item in wait.call_args_list], [1, 2])

    def test_second_cycle_restores_first_model_after_transient_failures(self):
        models = list(checker.GEMINI_MODELS)
        responses = [self.http_error(503) for _ in range(9)] + [{}]
        with patch.object(checker, "gemini_evidence", side_effect=responses) as call, patch.object(checker, "sleep") as wait:
            evidence = checker.gemini_evidence_with_fallback("test", models[0], [])
        self.assertEqual(evidence, {})
        self.assertEqual([item.args[1] for item in call.call_args_list],
                         [model for model in models for _ in range(3)] + [models[0]])
        self.assertEqual([item.args[0] for item in wait.call_args_list], [1, 2] * len(models) + [5])

    def test_switching_models_keeps_prior_document_results(self):
        rules = self.foreign_rules()
        slots = list(rules["required"])
        target = slots[1]
        models = checker.GEMINI_MODELS

        def analyze(key, model, documents):
            self.assertEqual(len(documents), 1)
            document = documents[0]
            if document["slot"] == target and model == models[0]:
                raise self.http_error(503)
            return self.mock_evidence(document)

        with patch.object(checker, "gemini_evidence", side_effect=analyze) as call, patch.object(checker, "sleep") as wait:
            ai = partial(checker.gemini_evidence_with_fallback, "test", models[0])
            report = self.synthetic_bundle(rules, set(slots), ai=ai)
        attempts = [(item.args[2][0]["slot"], item.args[1]) for item in call.call_args_list]
        expected = [(slot, models[0]) for slot in slots]
        expected[1:2] = [(target, models[0])] * 3 + [(target, models[1])]
        self.assertEqual(attempts, expected)
        self.assertEqual(report["status"], "checklist_matched")
        self.assertEqual([item.args[0] for item in wait.call_args_list], [1, 2])

    def test_exhausted_models_only_flag_affected_document_and_check_rest(self):
        rules = self.foreign_rules()
        slots = list(rules["required"])
        target = slots[1]
        models = checker.GEMINI_MODELS

        def analyze(key, model, documents):
            self.assertEqual(len(documents), 1)
            document = documents[0]
            if document["slot"] == target:
                raise self.http_error(503)
            return self.mock_evidence(document)

        with patch.object(checker, "gemini_evidence", side_effect=analyze) as call, patch.object(checker, "sleep") as wait:
            ai = partial(checker.gemini_evidence_with_fallback, "test", models[0])
            report = self.synthetic_bundle(rules, set(slots), ai=ai)
        attempts = [item.args[2][0]["slot"] for item in call.call_args_list]
        self.assertEqual(attempts, slots[:1] + [target] * (len(models) * 15) + slots[2:])
        self.assertEqual(self.failed_slots(report), {target})
        self.assertEqual(report["failed_document_count"], 1)
        self.assertIn("서버가 혼잡", report["problem_lines"][0])
        self.assertIn("서버가 혼잡", report["analysis_issue"])
        waits = [item.args[0] for item in wait.call_args_list]
        self.assertEqual([delay for delay in waits if delay > 2], [5, 10, 15, 20])
        self.assertEqual([delay for delay in waits if delay <= 2], [1, 2] * len(models) * 5)
        target_models = [item.args[1] for item in call.call_args_list if item.args[2][0]["slot"] == target]
        self.assertEqual(target_models, [model for model in models for _ in range(3)] * 5)
        self.assertIn("다시 검사", report["analysis_issue"])

    def test_only_transient_models_retry_and_mixed_errors_stay_distinct(self):
        models = list(checker.GEMINI_MODELS)
        responses = (
            [self.http_error(403)] + [self.http_error(503) for _ in range(3)]
            + [ValueError()] + [self.http_error(503) for _ in range(12)]
        )
        with patch.object(checker, "gemini_evidence", side_effect=responses) as call, patch.object(checker, "sleep"):
            with self.assertRaises(checker.GeminiAnalysisError) as raised:
                checker.gemini_evidence_with_fallback("test", models[0], [])
        self.assertEqual([item.args[1] for item in call.call_args_list], [models[0]] + [models[1]] * 3 + [models[2]] + [models[1]] * 12)
        self.assertIn("HTTP 403", str(raised.exception))
        self.assertNotIn("서버가 혼잡", str(raised.exception))



if __name__ == "__main__":
    unittest.main()
