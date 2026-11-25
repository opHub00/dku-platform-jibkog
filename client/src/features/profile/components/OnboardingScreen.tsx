import { useEffect, useId, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { profileRepository } from "../api/profileRepository";
import { AREA_OPTIONS, DEFAULT_PROFILE, DEPENDENTS_OPTIONS, HOME_TYPE_OPTIONS, INCOME_OPTIONS, MOVE_IN_OPTIONS, NAME_MAX_LENGTH, SIDO_OPTIONS, SIGUNGU_MAX_LENGTH, SUBSCRIPTION_OPTIONS } from "../data/options";
import { regionKey } from "../lib/profileText";
import type { AreaPreference, HomeType, IncomeBracket, MoveInTiming, Region, SubscriptionPeriod } from "../types";
import "@/features/presale/presale.css";
import "../onboarding.css";

type Screen = "basic" | "qualify" | "preference" | "summary";

const HOMELESS_CHOICES = [
  { label: "없음", years: 0 },
  { label: "1~3년", years: 2 },
  { label: "3~5년", years: 4 },
  { label: "5년 이상", years: 6 },
];

const PROGRESS: Record<Screen, number> = { basic: 25, qualify: 50, preference: 75, summary: 100 };

function digits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function OnboardingScreen({ initialName, onComplete }: { initialName?: string; onComplete: (saved: boolean) => void }) {
  const [screen, setScreen] = useState<Screen>("basic");
  const [qualifyStep, setQualifyStep] = useState(0);
  const [name, setName] = useState(initialName ?? "");
  const [sido, setSido] = useState(DEFAULT_PROFILE.residence.sido);
  const [sigungu, setSigungu] = useState("");
  const [homelessLabel, setHomelessLabel] = useState<string | null>(null);
  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket | null>(null);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<SubscriptionPeriod | null>(null);
  const [dependents, setDependents] = useState<number | null>(null);
  const [regionOptions, setRegionOptions] = useState<Region[]>([]);
  const [interestRegions, setInterestRegions] = useState<Region[]>([]);
  const [interestAreas, setInterestAreas] = useState<AreaPreference[]>([]);
  const [homeType, setHomeType] = useState<HomeType | null>(null);
  const [moveInTiming, setMoveInTiming] = useState<MoveInTiming | null>(null);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const sigunguId = useId();

  useEffect(() => {
    let active = true;
    presaleRepository.listComplexes().then((complexes) => {
      if (!active) return;
      const unique = new Map<string, Region>();
      for (const complex of complexes) unique.set(regionKey(complex), { sido: complex.sido, sigungu: complex.sigungu });
      setRegionOptions([...unique.values()]);
    });
    return () => {
      active = false;
    };
  }, []);

  function toggleRegion(region: Region) {
    const key = regionKey(region);
    const selected = interestRegions.some((r) => regionKey(r) === key);
    if (selected) return setInterestRegions(interestRegions.filter((r) => regionKey(r) !== key));
    if (interestRegions.length >= 3) return toast("관심지역은 최대 3곳까지 고를 수 있어요");
    setInterestRegions([...interestRegions, region]);
  }

  function toggleArea(area: AreaPreference) {
    setInterestAreas(interestAreas.includes(area) ? interestAreas.filter((a) => a !== area) : [...interestAreas, area]);
  }

  function goNext() {
    if (screen === "basic") setScreen("qualify");
    else if (screen === "qualify") setScreen("preference");
    else if (screen === "preference") setScreen("summary");
  }

  function goBack() {
    if (screen === "basic") return onComplete(false);
    if (screen === "qualify") {
      if (qualifyStep > 0) return setQualifyStep(qualifyStep - 1);
      return setScreen("basic");
    }
    if (screen === "preference") return setScreen("qualify");
    setScreen("preference");
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    const resolvedSigungu = sigungu.trim();
    const residence = resolvedSigungu ? { sido, sigungu: resolvedSigungu } : DEFAULT_PROFILE.residence;
    const homelessYears = HOMELESS_CHOICES.find((choice) => choice.label === homelessLabel)?.years ?? null;
    try {
      await profileRepository.saveProfile({
        name: name.trim() || initialName || DEFAULT_PROFILE.name,
        age: null,
        residence,
        homelessYears,
        incomeBracket,
        subscriptionPeriod,
        dependents,
        interestRegions: interestRegions.length > 0 ? interestRegions : [residence],
        interestAreas,
        homeType,
        moveInTiming,
        budgetMin: budgetMin === "" ? null : Number(budgetMin) * 10_000,
        budgetMax: budgetMax === "" ? null : Number(budgetMax) * 10_000,
      });
      onComplete(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장하지 못했어요");
      setSaving(false);
    }
  }

  if (screen === "summary") {
    const incomeLabel = INCOME_OPTIONS.find((option) => option.value === incomeBracket)?.label ?? "미입력";
    const subscriptionLabel = SUBSCRIPTION_OPTIONS.find((option) => option.value === subscriptionPeriod)?.label ?? "미입력";
    const areaLabel = interestAreas.length > 0 ? interestAreas.map((area) => AREA_OPTIONS.find((option) => option.value === area)?.label).join(", ") : "미입력";
    const budgetLabel = budgetMin || budgetMax ? `${budgetMin ? `${budgetMin}만원` : "0원"} ~ ${budgetMax ? `${budgetMax}만원` : "무제한"}` : "미입력";
    const homeTypeLabel = HOME_TYPE_OPTIONS.find((option) => option.value === homeType)?.label ?? "미입력";
    const moveInLabel = MOVE_IN_OPTIONS.find((option) => option.value === moveInTiming)?.label ?? "미입력";
    const dependentsLabel = DEPENDENTS_OPTIONS.find((option) => option.value === dependents)?.label ?? "미입력";
    return (
      <div className="onboarding-screen">
        <div className="onboarding-inner summary-inner">
          <div className="summary-check">
            <CheckCircle2 size={30} />
          </div>
          <p className="eyebrow">PROFILE COMPLETE</p>
          <h1>
            {name.trim() || initialName || DEFAULT_PROFILE.name}님의<br />
            <span>집 찾기 프로필</span>이 완성됐어요.
          </h1>
          <p className="summary-lead">
            이제 맞춤 매물과<br />청약 소식을 먼저 보여드릴게요.
          </p>
          <div className="profile-summary-card">
            <div className="profile-summary-head">
              <div className="profile-avatar">{(name.trim() || initialName || DEFAULT_PROFILE.name).slice(-2)}</div>
              <div>
                <strong>{name.trim() || initialName || DEFAULT_PROFILE.name}님</strong>
                <span>{sido} {sigungu.trim() || DEFAULT_PROFILE.residence.sigungu}</span>
              </div>
              <button onClick={() => setScreen("basic")} aria-label="기본 정보 수정">
                <Pencil size={15} />
              </button>
            </div>
            <div className="summary-divider" />
            <div className="summary-row">
              <span>관심지역</span>
              <strong>{interestRegions.length > 0 ? interestRegions.map(regionKey).join(" · ") : "미입력"}</strong>
            </div>
            <div className="summary-row">
              <span>청약 조건</span>
              <strong>소득 {incomeLabel} · 청약통장 {subscriptionLabel} · 부양가족 {dependentsLabel}</strong>
            </div>
            <div className="summary-row">
              <span>찾는 집</span>
              <strong>{homeTypeLabel} · {areaLabel} · {budgetLabel}</strong>
            </div>
            <div className="summary-row">
              <span>입주 희망 시기</span>
              <strong>{moveInLabel}</strong>
            </div>
          </div>
          <button className="auth-primary summary-button" onClick={() => void finish()} disabled={saving}>
            {saving ? "저장하는 중이에요" : "이대로 시작하기"} <ChevronRight size={17} />
          </button>
          <button className="back-link" onClick={() => setScreen("preference")}>
            <Pencil size={14} /> 프로필 수정
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-screen">
      <div className="onboarding-inner">
          <header className="onboarding-header">
            <button className="back-circle" onClick={goBack} aria-label="이전">
              <ArrowLeft size={18} />
            </button>
            <div className="progress-wrap">
              <span style={{ width: `${PROGRESS[screen]}%` }} />
            </div>
            <span className="step-count">{screen === "basic" ? "1" : screen === "qualify" ? "2" : "3"} / 3</span>
          </header>

          {screen === "basic" && (
            <>
              <p className="eyebrow">BASIC INFO</p>
              <h1>
                기본 정보를<br />
                <span>알려주세요.</span>
              </h1>
              <p className="onboarding-description">
                맞춤 매물을 찾는 데 필요한<br />최소한의 정보만 받을게요.
              </p>
              <div className="form-stack">
                <label htmlFor={nameId}>
                  이름
                  <input id={nameId} maxLength={NAME_MAX_LENGTH} placeholder="예: 주예나" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  사는 곳
                  <div className="filter-row">
                    {SIDO_OPTIONS.map((option) => (
                      <button key={option} className={`filter-chip ${sido === option ? "active" : ""}`} onClick={() => setSido(option)} aria-pressed={sido === option}>
                        {option}
                      </button>
                    ))}
                  </div>
                </label>
                <label htmlFor={sigunguId}>
                  시군구
                  <input id={sigunguId} maxLength={SIGUNGU_MAX_LENGTH} placeholder="예: 서초구" value={sigungu} onChange={(event) => setSigungu(event.target.value)} />
                </label>
              </div>
              <button className="onboarding-cta" onClick={goNext}>
                청약 자격 설정하기 <ChevronRight size={17} />
              </button>
            </>
          )}

          {screen === "qualify" && (
            <div className="question-block">
              <span className="question-count">{qualifyStep + 1} / 4</span>
              <h2>{qualifyStep === 0 ? "무주택 기간이 어떻게 되나요?" : qualifyStep === 1 ? "연소득 구간이 어떻게 되나요?" : qualifyStep === 2 ? "청약통장 가입기간은 어떻게 되나요?" : "부양가족은 몇 명인가요?"}</h2>
              <div className="choice-grid">
                {qualifyStep === 0 &&
                  HOMELESS_CHOICES.map((choice) => (
                    <button key={choice.label} className={homelessLabel === choice.label ? "selected" : ""} onClick={() => setHomelessLabel(choice.label)}>
                      {choice.label}
                      {homelessLabel === choice.label && <Check size={14} />}
                    </button>
                  ))}
                {qualifyStep === 1 &&
                  INCOME_OPTIONS.map((option) => (
                    <button key={option.value} className={incomeBracket === option.value ? "selected" : ""} onClick={() => setIncomeBracket(option.value)}>
                      {option.label}
                      {incomeBracket === option.value && <Check size={14} />}
                    </button>
                  ))}
                {qualifyStep === 2 &&
                  SUBSCRIPTION_OPTIONS.map((option) => (
                    <button key={option.value} className={subscriptionPeriod === option.value ? "selected" : ""} onClick={() => setSubscriptionPeriod(option.value)}>
                      {option.label}
                      {subscriptionPeriod === option.value && <Check size={14} />}
                    </button>
                  ))}
                {qualifyStep === 3 &&
                  DEPENDENTS_OPTIONS.map((option) => (
                    <button key={option.value} className={dependents === option.value ? "selected" : ""} onClick={() => setDependents(option.value)}>
                      {option.label}
                      {dependents === option.value && <Check size={14} />}
                    </button>
                  ))}
              </div>
              <button className="question-next" onClick={() => (qualifyStep < 3 ? setQualifyStep(qualifyStep + 1) : goNext())}>
                {qualifyStep < 3 ? "다음 조건" : "주거 선호 입력하기"} <ChevronRight size={16} />
              </button>
            </div>
          )}

          {screen === "preference" && (
            <>
              <p className="eyebrow">주거 선호</p>
              <h1>
                원하는 집을<br />
                <span>조금 더 알려주세요.</span>
              </h1>
              <p className="onboarding-description">나중에 MY에서 언제든 바꿀 수 있어요.</p>
              <div className="preference-form">
                <div className="preference-group">
                  <span>현재 거주지역</span>
                  <button className="location-select" onClick={() => setScreen("basic")}>
                    <MapPin size={15} /> {sido} {sigungu.trim() || "시군구 입력"}
                    <ChevronRight size={15} />
                  </button>
                </div>
                <div className="preference-group">
                  <span>
                    관심지역 <em>최대 3곳</em>
                  </span>
                  <div className="mini-choice-row">
                    {regionOptions.map((region) => {
                      const key = regionKey(region);
                      const selected = interestRegions.some((r) => regionKey(r) === key);
                      return (
                        <button key={key} className={selected ? "selected" : ""} onClick={() => toggleRegion(region)}>
                          {key} {selected && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="preference-group">
                  <span>희망 면적</span>
                  <div className="mini-choice-row">
                    {AREA_OPTIONS.map((option) => (
                      <button key={option.value} className={interestAreas.includes(option.value) ? "selected" : ""} onClick={() => toggleArea(option.value)}>
                        {option.label} {interestAreas.includes(option.value) && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="preference-group">
                  <span>희망 주거 형태</span>
                  <div className="mini-choice-row">
                    {HOME_TYPE_OPTIONS.map((option) => (
                      <button key={option.value} className={homeType === option.value ? "selected" : ""} onClick={() => setHomeType(homeType === option.value ? null : option.value)}>
                        {option.label} {homeType === option.value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="preference-group">
                  <span>입주 희망 시기</span>
                  <div className="mini-choice-row">
                    {MOVE_IN_OPTIONS.map((option) => (
                      <button key={option.value} className={moveInTiming === option.value ? "selected" : ""} onClick={() => setMoveInTiming(moveInTiming === option.value ? null : option.value)}>
                        {option.label} {moveInTiming === option.value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="preference-group">
                  <span>예상 예산</span>
                  <div className="ps-grid-2">
                    <label className="search-bar ps-input-bar">
                      <input className="ps-input" inputMode="numeric" placeholder="최소" value={budgetMin} onChange={(event) => setBudgetMin(digits(event.target.value, 7))} />
                      <em className="ps-unit">만원</em>
                    </label>
                    <label className="search-bar ps-input-bar">
                      <input className="ps-input" inputMode="numeric" placeholder="최대" value={budgetMax} onChange={(event) => setBudgetMax(digits(event.target.value, 7))} />
                      <em className="ps-unit">만원</em>
                    </label>
                  </div>
                </div>
              </div>
              <button className="onboarding-cta" onClick={goNext}>
                내 프로필 확인하기 <ChevronRight size={17} />
              </button>
            </>
          )}

          <button className="skip-link" onClick={() => onComplete(false)}>
            나중에 입력하기
          </button>
        </div>
      </div>
  );
}


