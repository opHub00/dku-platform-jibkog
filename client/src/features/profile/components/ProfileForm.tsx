import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/common/SectionHeader";
import { presaleRepository } from "@/features/presale/api/presaleRepository";
import { formatWon } from "@/features/presale/lib/format";
import { profileRepository } from "../api/profileRepository";
import {
  AREA_OPTIONS,
  DEFAULT_PROFILE,
  INCOME_OPTIONS,
  NAME_MAX_LENGTH,
  SIDO_OPTIONS,
  SIGUNGU_MAX_LENGTH,
  SUBSCRIPTION_OPTIONS,
} from "../data/options";
import { regionKey, validateProfile } from "../lib/profileText";
import type { AreaPreference, ProfileErrors, Region, UserProfile } from "../types";
// 매물 등록 화면과 같은 입력·칩·하단 버튼 스타일(ps-)을 그대로 쓴다.
import "@/features/presale/presale.css";
import "../profile.css";

const MAN = 10_000;

type Draft = Omit<UserProfile, "savedAt">;

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, maxLength);
}

function toNumber(digits: string): number | null {
  return digits === "" ? null : Number(digits);
}

function toDigits(value: number | null): string {
  return value === null ? "" : String(value);
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  maxLength,
  placeholder,
  error,
  hint,
  format,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (digits: string) => void;
  maxLength: number;
  placeholder?: string;
  error?: string;
  hint?: string;
  format?: boolean;
}) {
  const id = useId();
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
          placeholder={placeholder ?? "비워둬도 돼요"}
          value={format && value !== "" ? Number(value).toLocaleString("ko-KR") : value}
          onChange={(event) => onChange(digitsOnly(event.target.value, maxLength))}
        />
        <em className="ps-unit">{unit}</em>
      </label>
      {error ? <p className="ps-hint ps-error">{error}</p> : hint && <p className="ps-hint">{hint}</p>}
    </div>
  );
}

export function ProfileForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (profile: UserProfile) => void;
}) {
  const [draft, setDraft] = useState<Draft>(DEFAULT_PROFILE);
  const [age, setAge] = useState("");
  const [homelessYears, setHomelessYears] = useState(toDigits(DEFAULT_PROFILE.homelessYears));
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [regionOptions, setRegionOptions] = useState<Region[]>([]);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const fieldRefs = useRef<Partial<Record<keyof ProfileErrors, HTMLElement | null>>>({});
  const nameId = useId();
  const sigunguId = useId();

  useEffect(() => {
    let active = true;
    // 관심지역 선택지는 분양권 단지 데이터의 시도·시군구를 쓴다(내 정보는 그쪽으로 보내지 않는다).
    Promise.all([profileRepository.getProfile(), presaleRepository.listComplexes()]).then(([profile, complexes]) => {
      if (!active) return;
      const { savedAt: _savedAt, ...rest } = profile;
      setDraft(rest);
      setAge(toDigits(profile.age));
      setHomelessYears(toDigits(profile.homelessYears));
      setBudgetMin(profile.budgetMin === null ? "" : String(Math.round(profile.budgetMin / MAN)));
      setBudgetMax(profile.budgetMax === null ? "" : String(Math.round(profile.budgetMax / MAN)));
      const unique = new Map<string, Region>();
      for (const complex of complexes) {
        const region = { sido: complex.sido, sigungu: complex.sigungu };
        unique.set(regionKey(region), region);
      }
      // 저장된 관심지역이 단지 데이터에 없더라도 선택지에서 사라지지 않게 함께 둔다.
      for (const region of profile.interestRegions) unique.set(regionKey(region), region);
      setRegionOptions([...unique.values()]);
    });
    return () => {
      active = false;
    };
  }, []);

  const selectedRegionKeys = useMemo(() => new Set(draft.interestRegions.map(regionKey)), [draft.interestRegions]);

  function update(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function toggleRegion(region: Region) {
    const key = regionKey(region);
    update({
      interestRegions: selectedRegionKeys.has(key)
        ? draft.interestRegions.filter((r) => regionKey(r) !== key)
        : [...draft.interestRegions, region],
    });
  }

  function toggleArea(area: AreaPreference) {
    update({
      interestAreas: draft.interestAreas.includes(area)
        ? draft.interestAreas.filter((a) => a !== area)
        : [...draft.interestAreas, area],
    });
  }

  function buildProfile(): Draft {
    const min = toNumber(budgetMin);
    const max = toNumber(budgetMax);
    return {
      ...draft,
      name: draft.name.trim(),
      residence: { sido: draft.residence.sido, sigungu: draft.residence.sigungu.trim() },
      age: toNumber(age),
      homelessYears: toNumber(homelessYears),
      budgetMin: min === null ? null : min * MAN,
      budgetMax: max === null ? null : max * MAN,
    };
  }

  async function save() {
    if (saving) return;
    const profile = buildProfile();
    const found = validateProfile(profile);
    setErrors(found);
    const firstError = (["name", "age", "residence", "homelessYears", "interestRegions", "budget"] as const).find((key) => found[key]);
    if (firstError) {
      fieldRefs.current[firstError]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      const saved = await profileRepository.saveProfile(profile);
      onSaved(saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장하지 못했어요");
      setSaving(false);
    }
  }

  const budgetMinWon = toNumber(budgetMin);
  const budgetMaxWon = toNumber(budgetMax);

  return (
    <div className="detail-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">MY · 프로필 · 관심지역 설정</p>
          <h1>내 정보를 알려주세요</h1>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="내 정보 닫기">
          <X size={19} />
        </button>
      </header>

      <main className="detail-body">
        <div className="safety-note pf-privacy-note">
          <ShieldCheck size={19} />
          <div>
            <strong>입력한 정보는 이 기기에만 저장돼요</strong>
            <p>소득·나이·무주택 기간은 다른 사람이나 다른 기능에 보내지 않아요.</p>
          </div>
        </div>

        <section className="detail-section">
          <SectionHeader eyebrow="필수" title="기본 정보" />
          <div className="ps-field" ref={(el) => { fieldRefs.current.name = el; }}>
            <label className="ps-label" htmlFor={nameId}>
              이름(닉네임)
            </label>
            <label className="search-bar ps-input-bar" htmlFor={nameId}>
              <input
                id={nameId}
                className="ps-input"
                maxLength={NAME_MAX_LENGTH}
                placeholder="예: 주예나"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            {errors.name && <p className="ps-hint ps-error">{errors.name}</p>}
          </div>

          <div className="ps-field" ref={(el) => { fieldRefs.current.residence = el; }}>
            <span className="ps-label">사는 곳</span>
            <div className="filter-row ps-chip-row pf-chip-wrap">
              {SIDO_OPTIONS.map((sido) => (
                <button
                  key={sido}
                  className={`filter-chip ${draft.residence.sido === sido ? "active" : ""}`}
                  onClick={() => update({ residence: { ...draft.residence, sido } })}
                  aria-pressed={draft.residence.sido === sido}
                >
                  {sido}
                </button>
              ))}
            </div>
            <label className="search-bar ps-input-bar pf-gap-top" htmlFor={sigunguId}>
              <input
                id={sigunguId}
                className="ps-input"
                maxLength={SIGUNGU_MAX_LENGTH}
                placeholder="시군구 예: 서초구, 수원시"
                value={draft.residence.sigungu}
                onChange={(event) => update({ residence: { ...draft.residence, sigungu: event.target.value } })}
              />
            </label>
            {errors.residence && <p className="ps-hint ps-error">{errors.residence}</p>}
          </div>

          <div className="ps-field" ref={(el) => { fieldRefs.current.interestRegions = el; }}>
            <span className="ps-label">관심지역 (여러 곳 고를 수 있어요)</span>
            <div className="filter-row ps-chip-row pf-chip-wrap">
              {regionOptions.map((region) => {
                const key = regionKey(region);
                const selected = selectedRegionKeys.has(key);
                return (
                  <button
                    key={key}
                    className={`filter-chip ${selected ? "active" : ""}`}
                    onClick={() => toggleRegion(region)}
                    aria-pressed={selected}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
            {errors.interestRegions ? (
              <p className="ps-hint ps-error">{errors.interestRegions}</p>
            ) : (
              <p className="ps-hint">{draft.interestRegions.length}곳 골랐어요</p>
            )}
          </div>
        </section>

        <section className="detail-section">
          <SectionHeader eyebrow="선택 · 비워둬도 저장돼요" title="청약 자격" />
          <div className="ps-grid-2">
            <div ref={(el) => { fieldRefs.current.age = el; }}>
              <NumberField label="나이" unit="세" value={age} onChange={setAge} maxLength={3} error={errors.age} />
            </div>
            <div ref={(el) => { fieldRefs.current.homelessYears = el; }}>
              <NumberField label="무주택 기간" unit="년" value={homelessYears} onChange={setHomelessYears} maxLength={2} error={errors.homelessYears} />
            </div>
          </div>
          <div className="ps-field">
            <span className="ps-label">연소득 구간</span>
            <div className="filter-row ps-chip-row pf-chip-wrap">
              {INCOME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`filter-chip ${draft.incomeBracket === option.value ? "active" : ""}`}
                  onClick={() => update({ incomeBracket: draft.incomeBracket === option.value ? null : option.value })}
                  aria-pressed={draft.incomeBracket === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="ps-hint">금액은 받지 않아요. 한 번 더 누르면 선택이 풀려요</p>
          </div>
          <div className="ps-field">
            <span className="ps-label">청약통장 가입 기간</span>
            <div className="filter-row ps-chip-row pf-chip-wrap">
              {SUBSCRIPTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`filter-chip ${draft.subscriptionPeriod === option.value ? "active" : ""}`}
                  onClick={() => update({ subscriptionPeriod: draft.subscriptionPeriod === option.value ? null : option.value })}
                  aria-pressed={draft.subscriptionPeriod === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="detail-section">
          <SectionHeader eyebrow="선택 · 비워둬도 저장돼요" title="원하는 집" />
          <div className="ps-field">
            <span className="ps-label">관심 면적 (여러 개 고를 수 있어요)</span>
            <div className="filter-row ps-chip-row pf-chip-wrap">
              {AREA_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`filter-chip ${draft.interestAreas.includes(option.value) ? "active" : ""}`}
                  onClick={() => toggleArea(option.value)}
                  aria-pressed={draft.interestAreas.includes(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div ref={(el) => { fieldRefs.current.budget = el; }}>
            <div className="ps-grid-2">
              <NumberField
                label="예산 최소"
                unit="만원"
                value={budgetMin}
                onChange={setBudgetMin}
                maxLength={7}
                format
                hint={budgetMinWon ? formatWon(budgetMinWon * MAN) : undefined}
              />
              <NumberField
                label="예산 최대"
                unit="만원"
                value={budgetMax}
                onChange={setBudgetMax}
                maxLength={7}
                format
                hint={budgetMaxWon ? formatWon(budgetMaxWon * MAN) : undefined}
              />
            </div>
            {errors.budget && <p className="ps-hint ps-error pf-budget-error">{errors.budget}</p>}
          </div>
        </section>
      </main>

      <div className="detail-actions ps-actions">
        <button className="action-secondary" onClick={onClose} disabled={saving}>
          취소
        </button>
        <button className="action-primary" onClick={() => void save()} disabled={saving}>
          {saving ? "저장하는 중이에요" : "저장하기"}
        </button>
      </div>
    </div>
  );
}
