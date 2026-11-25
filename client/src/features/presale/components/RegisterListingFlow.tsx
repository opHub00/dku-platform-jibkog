import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  CircleHelp,
  FileCheck2,
  FileText,
  LayoutGrid,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/common/StatusPill";
import { SectionHeader } from "@/components/common/SectionHeader";
import { extractContract, screenDescription } from "../ai/aiClient";
import { evaluateTrust } from "../ai/trustEngine";
import { CONTRACT_MEDIA_TYPES, type AiResult, type ContractExtraction, type DescriptionScreening } from "../ai/types";
import { presaleRepository, REVIEW_THRESHOLD_SCORE } from "../api/presaleRepository";
import { calcFundsBreakdown } from "../lib/funds";
import { formatMonth, formatWon } from "../lib/format";
import { getResaleRestriction } from "../lib/resale";
import type {
  Complex,
  NewPresaleListingInput,
  PresaleDocument,
  PresaleDocumentType,
  PresaleListing,
  Seller,
  TrustReport,
} from "../types";
import { TrustReportView } from "./TrustReportView";
import { getCatalogComplex, searchCatalogComplexes } from "@/features/catalog/api/catalogApi";
import { shortAddress } from "@/features/catalog/lib/noticeText";
import { catalogToComplex, housingTypeLabel, roundArea } from "@/features/catalog/lib/catalogComplex";
import type { CatalogComplex, CatalogComplexDetail, HousingType } from "@/features/catalog/types";
import "../presale.css";

type Step = "complex" | "terms" | "documents" | "verify";

const STEPS: { key: Step; title: string }[] = [
  { key: "complex", title: "어느 단지인가요?" },
  { key: "terms", title: "거래 조건을 알려주세요" },
  { key: "documents", title: "서류를 올려주세요" },
  { key: "verify", title: "AI가 매물을 확인해요" },
];

const DOCUMENTS: { type: PresaleDocumentType; label: string; required: boolean }[] = [
  { type: "salesContract", label: "분양계약서", required: true },
  { type: "paymentProof", label: "납부확인서", required: false },
  { type: "optionContract", label: "옵션계약서", required: false },
];

/** 서버 요청 한도(20MB)를 base64 증가분(약 1.33배)을 감안해 나눈 값 */
const MAX_FILE_BYTES = 14 * 1024 * 1024;
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAN = 10_000;

type VerifyTaskStatus = "waiting" | "running" | "done";
const VERIFY_TASKS = ["분양계약서 인식", "설명 위험 문구 검사", "주변 시세 비교", "신뢰 점수 계산"] as const;

type Files = Record<PresaleDocumentType, File | null>;

/** "21,600" 같은 입력에서 숫자만 남긴다 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9);
}

function manwonToWon(digits: string): number | null {
  return digits === "" ? null : Number(digits) * MAN;
}

function MoneyField({
  label,
  value,
  onChange,
  error,
  placeholder,
  note,
}: {
  label: string;
  value: string;
  onChange: (digits: string) => void;
  error?: string;
  placeholder?: string;
  /** 값 아래 덧붙이는 안내(예: 공고 기준 금액) */
  note?: string;
}) {
  const id = useId();
  const won = manwonToWon(value);
  return (
    <div className="ps-field">
      <label className="ps-label" htmlFor={id}>
        {label}
      </label>
      <label className="search-bar ps-input-bar" htmlFor={id}>
        <input
          id={id}
          className="ps-input"
          inputMode="numeric"
          placeholder={placeholder ?? "0"}
          value={value === "" ? "" : Number(value).toLocaleString("ko-KR")}
          onChange={(event) => onChange(digitsOnly(event.target.value))}
        />
        <em className="ps-unit">만원</em>
      </label>
      {error ? (
        <p className="ps-hint ps-error">{error}</p>
      ) : (
        won !== null && won > 0 && <p className="ps-hint">{formatWon(won)}</p>
      )}
      {note && <p className="ps-hint">{note}</p>}
    </div>
  );
}

export function RegisterListingFlow({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered?: (listing: PresaleListing) => void;
}) {
  const [step, setStep] = useState<Step>("complex");
  const [complexes, setComplexes] = useState<Complex[]>([]);
  const [seller, setSeller] = useState<Seller | null>(null);

  const [query, setQuery] = useState("");
  // 1단계: 청약 공고 단지 검색(GET /api/catalog/complexes) → 주택형 선택
  const [results, setResults] = useState<{ items: CatalogComplex[]; total: number } | null>(null);
  const [searchFailed, setSearchFailed] = useState(false);
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [catalogDetail, setCatalogDetail] = useState<CatalogComplexDetail | null>(null);
  const [modelNumber, setModelNumber] = useState<string | null>(null);

  const [area, setArea] = useState<number | null>(null);
  const [floor, setFloor] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [premium, setPremium] = useState("");
  const [optionCost, setOptionCost] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [description, setDescription] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const [files, setFiles] = useState<Files>({
    salesContract: null,
    paymentProof: null,
    optionContract: null,
  });

  const [tasks, setTasks] = useState<VerifyTaskStatus[]>(VERIFY_TASKS.map(() => "waiting"));
  const [report, setReport] = useState<TrustReport | null>(null);
  const [verification, setVerification] = useState<{ contract: AiResult<ContractExtraction>; screening: AiResult<DescriptionScreening> } | null>(null);
  const [draft, setDraft] = useState<NewPresaleListingInput | null>(null);
  const [registering, setRegistering] = useState(false);
  const runId = useRef(0);

  const floorId = useId();
  const descriptionId = useId();
  const searchId = useId();

  useEffect(() => {
    let active = true;
    Promise.all([presaleRepository.listComplexes(), presaleRepository.getCurrentSeller()]).then(
      ([loadedComplexes, loadedSeller]) => {
        if (!active) return;
        setComplexes(loadedComplexes);
        setSeller(loadedSeller);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      searchCatalogComplexes({ q: query })
        .then((page) => {
          if (!active) return;
          setResults({ items: page.items, total: page.total });
          setSearchFailed(false);
        })
        .catch(() => {
          if (!active) return;
          setResults({ items: [], total: 0 });
          setSearchFailed(true);
        });
    }, query.trim() === "" ? 0 : 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const complex = useMemo(
    () => (catalogDetail && catalogDetail.id === catalogId ? catalogToComplex(catalogDetail, complexes) : null),
    [catalogDetail, catalogId, complexes],
  );
  const housingType = catalogDetail?.housingTypes.find((h) => h.modelNumber === modelNumber) ?? null;
  const restriction = complex ? getResaleRestriction(complex) : null;

  function selectCatalogComplex(id: string) {
    if (id === catalogId) return;
    setCatalogId(id);
    setCatalogDetail(null);
    setModelNumber(null);
    getCatalogComplex(id)
      .then((detail) => setCatalogDetail(detail))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "주택형을 불러오지 못했어요");
        setCatalogId(null);
      });
  }

  /** 주택형을 고르면 공고 기준 공급면적·분양가(최고가)를 채운다. 다음 단계에서 고칠 수 있다 */
  function selectHousingType(type: HousingType) {
    setModelNumber(type.modelNumber);
    setArea(roundArea(type.supplyAreaM2));
    setSalePrice(String(Math.round(type.maxPriceWon / MAN)));
  }

  // ---------- 2단계 값 검증 ----------
  const sale = manwonToWon(salePrice);
  const prem = manwonToWon(premium);
  const option = manwonToWon(optionCost) ?? 0;
  const paid = manwonToWon(paidAmount);
  const floorNumber = floor === "" ? null : Number(floor);

  const termErrors = {
    area: area === null ? "면적을 골라주세요" : undefined,
    floor:
      floorNumber === null || floorNumber < 1 || floorNumber > 99
        ? "1~99층 사이로 입력해주세요"
        : undefined,
    salePrice:
      sale === null || sale <= 0
        ? "분양가를 입력해주세요"
        : housingType && sale > housingType.maxPriceWon
          ? `공고 최고가(${formatWon(housingType.maxPriceWon)})보다 클 수 없어요`
          : undefined,
    premium: prem === null ? "프리미엄을 입력해주세요. 없으면 0이에요" : undefined,
    paidAmount:
      paid === null
        ? "지금까지 낸 금액을 입력해주세요"
        : sale !== null && paid > sale + option
          ? "분양가와 옵션비를 더한 금액보다 클 수 없어요"
          : undefined,
    description:
      description.trim().length < MIN_DESCRIPTION_LENGTH
        ? `${MIN_DESCRIPTION_LENGTH}자 이상 적어주세요`
        : undefined,
  };
  const termsValid = Object.values(termErrors).every((e) => e === undefined);

  const funds =
    sale !== null && prem !== null
      ? calcFundsBreakdown({
          salePrice: sale,
          premium: prem,
          optionCost: option,
          paidAmount: paid ?? 0,
        })
      : null;

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ---------- 3단계 파일 ----------
  function handleFile(type: PresaleDocumentType, file: File | undefined) {
    if (!file) return;
    if (!(CONTRACT_MEDIA_TYPES as readonly string[]).includes(file.type)) {
      toast.error("PDF, JPG, PNG, WEBP 파일만 올릴 수 있어요");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("14MB 이하 파일만 올릴 수 있어요");
      return;
    }
    setFiles((prev) => ({ ...prev, [type]: file }));
  }

  // ---------- 4단계 AI 검증 ----------
  function setTask(index: number, status: VerifyTaskStatus) {
    setTasks((prev) => prev.map((s, i) => (i === index ? status : s)));
  }

  async function runVerification() {
    const contractFile = files.salesContract;
    if (!complex || !seller || !contractFile || area === null || floorNumber === null) return;
    if (sale === null || prem === null || paid === null) return;

    const currentRun = ++runId.current;
    const isCurrent = () => runId.current === currentRun;
    setReport(null);
    setVerification(null);
    setDraft(null);
    setTasks(["running", "running", "waiting", "waiting"]);

    const [contract, screening, currentSeller] = await Promise.all([
      extractContract(contractFile, {
        complexName: complex.name,
        area,
        salePrice: sale,
        contractorName: seller.realName,
      }).then((result) => {
        if (isCurrent()) setTask(0, "done");
        return result;
      }),
      screenDescription(description.trim()).then((result) => {
        if (isCurrent()) setTask(1, "done");
        return result;
      }),
      presaleRepository.getCurrentSeller(),
    ]);
    if (!isCurrent()) return;

    setTask(2, "running");
    const allListings = await presaleRepository.listListings();
    if (!isCurrent()) return;
    setTask(2, "done");
    setTask(3, "running");

    const input: NewPresaleListingInput = {
      complexId: complex.id,
      ...(catalogId && modelNumber ? { catalogComplexId: catalogId, housingModelNumber: modelNumber } : {}),
      seller: currentSeller,
      area,
      floor: floorNumber,
      salePrice: sale,
      premium: prem,
      optionCost: option,
      paidAmount: paid,
      description: description.trim(),
      documents: buildDocuments(contract),
    };
    const result = evaluateTrust({
      listing: {
        ...input,
        id: 0,
        status: "selling",
        liked: false,
        createdAt: new Date().toISOString(),
      },
      complex,
      allListings,
      allComplexes: complexes,
      contract,
      screening,
    });
    setTask(3, "done");
    setDraft(input);
    setReport(result);
    setVerification({ contract, screening });
  }

  function buildDocuments(contract: AiResult<ContractExtraction>): PresaleDocument[] {
    return DOCUMENTS.map(({ type }): PresaleDocument => {
      if (!files[type]) return { type, status: "missing" };
      if (type === "salesContract") {
        const trusted =
          contract.mode === "live" &&
          contract.result.confidence >= 0.6 &&
          contract.result.forgeryNotes.length === 0;
        return { type, status: trusted ? "verified" : "pending" };
      }
      return { type, status: "pending" }; // AI가 읽지 않은 서류는 확인 대기
    });
  }

  async function register() {
    if (!draft || !report || !verification || registering) return;
    setRegistering(true);
    try {
      const created = await presaleRepository.createListing(draft, { trust: report, verification });
      if (created.status === "review") {
        toast("등록했어요. 검토를 마치면 목록에 보여드릴게요");
      } else {
        toast.success("등록했어요. 지금부터 매물 목록에 보여요");
      }
      onRegistered?.(created);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "등록하지 못했어요");
      setRegistering(false);
    }
  }

  // ---------- 이동 ----------
  function goNext() {
    if (step === "complex") {
      if (!complex || !housingType || restriction?.restricted) return;
      if (area !== null && !complex.supplyAreas.includes(area)) setArea(null);
      setStep("terms");
    } else if (step === "terms") {
      if (!termsValid) {
        setShowErrors(true);
        return;
      }
      setStep("documents");
    } else if (step === "documents") {
      if (!files.salesContract) {
        toast.error("분양계약서는 꼭 올려주세요");
        return;
      }
      setStep("verify");
      void runVerification();
    } else {
      void register();
    }
  }

  function goBack() {
    if (step === "complex") {
      onClose();
      return;
    }
    if (step === "verify") {
      runId.current += 1; // 진행 중인 검증 결과는 버린다
      setReport(null);
      setVerification(null);
      setDraft(null);
    }
    setStep(STEPS[stepIndex - 1].key);
  }

  const nextDisabled =
    (step === "complex" && (!complex || !housingType || restriction?.restricted === true)) ||
    (step === "documents" && !files.salesContract) ||
    (step === "verify" && (!report || registering));

  const nextLabel =
    step === "documents"
      ? "AI 검증 시작"
      : step === "verify"
        ? report && report.score < REVIEW_THRESHOLD_SCORE
          ? "검토 요청하기"
          : "등록하기"
        : "다음";

  // ---------- 화면 ----------
  return (
    <div className="detail-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            분양권 매물 등록 · {stepIndex + 1}/{STEPS.length}
          </p>
          <h1>{STEPS[stepIndex].title}</h1>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="등록 닫기">
          <X size={19} />
        </button>
      </header>
      <div className="ps-progress">
        <div className="meter-track">
          <span className="ps-meter-fill" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <main className="detail-body">
        {step === "complex" && (
          <section className="detail-section">
            <label className="search-bar ps-input-bar" htmlFor={searchId}>
              <Search size={16} />
              <input
                id={searchId}
                className="ps-input"
                placeholder="단지명이나 동네로 찾아보세요"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {results === null ? (
              <p className="ps-empty">청약 공고 단지를 찾고 있어요</p>
            ) : results.items.length === 0 ? (
              <p className="ps-empty">
                {searchFailed
                  ? "단지 목록을 불러오지 못했어요. 잠시 뒤 다시 검색해주세요"
                  : "찾는 단지가 없어요. 청약홈에 분양 공고가 올라온 단지만 찾을 수 있어요"}
              </p>
            ) : (
              <div className="alert-list ps-complex-list">
                {results.items.map((c) => {
                  const selected = c.id === catalogId;
                  return (
                    <button
                      key={c.id}
                      className={`alert-row ps-select-row ${selected ? "active" : ""}`}
                      onClick={() => selectCatalogComplex(c.id)}
                      aria-pressed={selected}
                    >
                      <span className="ai-badge">
                        <Building2 size={17} />
                      </span>
                      <div>
                        <strong>{c.name}</strong>
                        <p>
                          {shortAddress(c)} · 입주 {c.moveInMonth ? formatMonth(c.moveInMonth) : "공고문 확인"}
                        </p>
                      </div>
                      {selected && <Check size={17} />}
                    </button>
                  );
                })}
              </div>
            )}
            {results !== null && results.total > results.items.length && (
              <p className="ps-hint">{results.total}개 중 {results.items.length}개를 보여드려요. 단지 이름을 더 자세히 적어주세요</p>
            )}
            {catalogId && (
              <div className="ps-complex-note">
                <SectionHeader eyebrow={catalogDetail?.name ?? "주택형"} title="주택형을 골라주세요" />
                {catalogDetail === null ? (
                  <p className="ps-empty">주택형을 불러오고 있어요</p>
                ) : (
                  <div className="alert-list ps-complex-list">
                    {catalogDetail.housingTypes.map((h) => {
                      const selected = h.modelNumber === modelNumber;
                      return (
                        <button
                          key={h.modelNumber}
                          className={`alert-row ps-select-row ${selected ? "active" : ""}`}
                          onClick={() => selectHousingType(h)}
                          aria-pressed={selected}
                        >
                          <span className="ai-badge">
                            <LayoutGrid size={17} />
                          </span>
                          <div>
                            <strong>{housingTypeLabel(h)}</strong>
                            <p>
                              전용 {roundArea(h.exclusiveAreaM2)}㎡ · 공급 {roundArea(h.supplyAreaM2)}㎡ · 최고 {formatWon(h.maxPriceWon)}
                            </p>
                          </div>
                          {selected && <Check size={17} />}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="ps-hint">면적과 분양가는 청약 공고 기준으로 채워드려요. 다음 단계에서 고칠 수 있어요</p>
              </div>
            )}
            {complex && restriction?.restricted && (
              <div className="safety-note ps-note-sand ps-complex-note">
                <ShieldAlert size={19} />
                <div>
                  <strong>전매제한 기간이라 아직 등록할 수 없어요</strong>
                  <p>
                    {restriction.endsOn}에 풀려요 · {restriction.daysLeft}일 남았어요
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {step === "terms" && complex && (
          <>
            <section className="detail-section">
              <SectionHeader eyebrow={complex.name} title="면적과 층" />
              <div className="ps-field">
                <span className="ps-label">면적</span>
                <div className="filter-row ps-chip-row">
                  {catalogDetail
                    ? catalogDetail.housingTypes.map((h) => (
                        <button
                          key={h.modelNumber}
                          className={`filter-chip ${h.modelNumber === modelNumber ? "active" : ""}`}
                          onClick={() => selectHousingType(h)}
                        >
                          {housingTypeLabel(h)}
                        </button>
                      ))
                    : complex.supplyAreas.map((a) => (
                        <button
                          key={a}
                          className={`filter-chip ${area === a ? "active" : ""}`}
                          onClick={() => setArea(a)}
                        >
                          {a}㎡
                        </button>
                      ))}
                </div>
                {showErrors && termErrors.area ? (
                  <p className="ps-hint ps-error">{termErrors.area}</p>
                ) : (
                  housingType && <p className="ps-hint">공고 기준 공급면적 {roundArea(housingType.supplyAreaM2)}㎡ · 주택형을 바꾸면 분양가도 다시 채워요</p>
                )}
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor={floorId}>
                  층
                </label>
                <label className="search-bar ps-input-bar" htmlFor={floorId}>
                  <input
                    id={floorId}
                    className="ps-input"
                    inputMode="numeric"
                    placeholder="예: 12"
                    value={floor}
                    onChange={(event) => setFloor(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  />
                  <em className="ps-unit">층</em>
                </label>
                {showErrors && termErrors.floor && <p className="ps-hint ps-error">{termErrors.floor}</p>}
              </div>
            </section>

            <section className="detail-section">
              <SectionHeader eyebrow="만원 단위로 적어주세요" title="거래 금액" />
              <div className="ps-grid-2">
                <MoneyField
                  label="분양가"
                  value={salePrice}
                  onChange={setSalePrice}
                  error={showErrors || (housingType !== null && sale !== null && sale > housingType.maxPriceWon) ? termErrors.salePrice : undefined}
                  note={housingType ? `공고 기준 최고가 ${formatWon(housingType.maxPriceWon)}. 실제 계약 금액으로 고쳐주세요` : undefined}
                />
                <MoneyField
                  label="프리미엄"
                  value={premium}
                  onChange={setPremium}
                  error={showErrors ? termErrors.premium : undefined}
                />
                <MoneyField label="옵션·확장비" value={optionCost} onChange={setOptionCost} />
                <MoneyField
                  label="지금까지 낸 금액"
                  value={paidAmount}
                  onChange={setPaidAmount}
                  error={showErrors ? termErrors.paidAmount : undefined}
                />
              </div>
              <section className="total-funds-card ps-funds-preview">
                <div className="funds-heading">
                  <div>
                    <p className="eyebrow">매수자 기준 미리보기</p>
                    <h2>예상 총 필요자금</h2>
                  </div>
                </div>
                <strong className="total-funds">{formatWon(funds ? funds.totalRequired : 0)}</strong>
                <div className="funds-breakdown">
                  <div>
                    <span>분양가</span>
                    <b>{sale !== null ? formatWon(sale) : "-"}</b>
                  </div>
                  <div>
                    <span>프리미엄</span>
                    <b className="accent-number">{prem !== null ? `+${formatWon(prem)}` : "-"}</b>
                  </div>
                  <div>
                    <span>옵션·확장비</span>
                    <b>{formatWon(option)}</b>
                  </div>
                </div>
                <p className="funds-caption">
                  <CircleHelp size={13} />
                  {funds && paid !== null
                    ? `계약할 때 매수자가 낼 금액은 ${formatWon(funds.atContract)}이에요.`
                    : "계약 시 지급액은 프리미엄과 낸 금액을 더해 계산해요."}
                </p>
              </section>
            </section>

            <section className="detail-section">
              <SectionHeader eyebrow="외부 연락처·선입금 요구는 적지 말아주세요" title="매물 설명" />
              <label className="ps-label" htmlFor={descriptionId}>
                동·향·옵션, 잔금 일정처럼 매수자가 궁금해할 내용을 적어주세요
              </label>
              <textarea
                id={descriptionId}
                className="ps-textarea"
                maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder="예: 남향 18층이고 발코니 확장 계약했어요."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <p className={`ps-hint ${showErrors && termErrors.description ? "ps-error" : ""}`}>
                {showErrors && termErrors.description
                  ? termErrors.description
                  : `${description.length} / ${MAX_DESCRIPTION_LENGTH}자`}
              </p>
            </section>
          </>
        )}

        {step === "documents" && (
          <section className="detail-section">
            <SectionHeader eyebrow="PDF·JPG·PNG·WEBP, 14MB 이하" title="거래 서류" />
            <div className="ps-doc-list">
              {DOCUMENTS.map((doc) => {
                const file = files[doc.type];
                return (
                  <div key={doc.type} className="document-card">
                    <div className="document-icon">
                      {file ? <FileCheck2 size={18} /> : <FileText size={18} />}
                    </div>
                    <div>
                      <strong>
                        {doc.label} {doc.required ? "(필수)" : "(권장)"}
                      </strong>
                      <p>
                        {file
                          ? file.name
                          : doc.required
                            ? "AI가 단지명·면적·분양가·계약자를 대조해요"
                            : "없으면 신뢰 점수가 크게 낮아져요"}
                      </p>
                    </div>
                    <div className="ps-doc-actions">
                      {file && <StatusPill tone="green">첨부됨</StatusPill>}
                      <label className="text-action ps-file-label">
                        {file ? "바꾸기" : "올리기"}
                        <input
                          type="file"
                          accept={CONTRACT_MEDIA_TYPES.join(",")}
                          onChange={(event) => {
                            handleFile(doc.type, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="sheet-footnote">
              <ShieldCheck size={12} /> 서류는 매물 검증에만 쓰고 매수자에게는 확인 결과만 보여요
            </p>
          </section>
        )}

        {step === "verify" && (
          <>
            <section className="detail-section safety-section">
              <SectionHeader eyebrow="집콕 AI 검증" title={report ? "확인을 마쳤어요" : "잠시만 기다려주세요"} />
              <div className="verification-list">
                {VERIFY_TASKS.map((label, index) => {
                  const status = tasks[index];
                  return (
                    <div key={label}>
                      {status === "done" ? (
                        <span className="check-icon">
                          <Check size={12} />
                        </span>
                      ) : status === "running" ? (
                        <span className="document-progress ps-spinner">
                          <span />
                        </span>
                      ) : (
                        <span className="ps-wait-icon" />
                      )}
                      <div>
                        <b>{label}</b>
                        <small>{status === "done" ? "완료했어요" : status === "running" ? "확인하고 있어요" : "기다리는 중이에요"}</small>
                      </div>
                      <StatusPill tone={status === "done" ? "green" : "neutral"}>
                        {status === "done" ? "완료" : status === "running" ? "진행 중" : "대기"}
                      </StatusPill>
                    </div>
                  );
                })}
              </div>
            </section>

            {report && (
              <>
                <TrustReportView report={report} />
                {report.score >= REVIEW_THRESHOLD_SCORE ? (
                  <div className="safety-note">
                    <ShieldCheck size={19} />
                    <div>
                      <strong>등록하면 바로 매물 목록에 보여요</strong>
                      <p>{REVIEW_THRESHOLD_SCORE}점 이상이라 검토 없이 노출해요</p>
                    </div>
                  </div>
                ) : (
                  <div className="safety-note ps-note-sand">
                    <ShieldAlert size={19} />
                    <div>
                      <strong>검토를 마친 뒤 목록에 보여요</strong>
                      <p>{REVIEW_THRESHOLD_SCORE}점 미만이라 집콕이 한 번 더 확인할게요</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <div className="detail-actions ps-actions">
        <button className="action-secondary" onClick={goBack} disabled={registering}>
          {step === "complex" ? "취소" : "이전"}
        </button>
        <button className="action-primary" onClick={goNext} disabled={nextDisabled}>
          {registering ? "등록하는 중이에요" : nextLabel}
        </button>
      </div>
    </div>
  );
}
