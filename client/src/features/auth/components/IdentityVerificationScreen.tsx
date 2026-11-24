import { useId, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { verifyIdentity } from "../lib/session";
import "@/features/presale/presale.css";
import "../auth.css";

export function IdentityVerificationScreen({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const codeId = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) return setError("인증번호 6자리를 입력해주세요");
    setBusy(true);
    setError(null);
    try {
      await verifyIdentity(code);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "인증을 완료하지 못했어요");
      setBusy(false);
    }
  }

  return <div className="detail-screen">
    <header className="page-header"><div><p className="eyebrow">내 정보</p><h1>본인 인증하기</h1></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={19} /></button></header>
    <main className="detail-body">
      <div className="safety-note au-reason"><ShieldCheck size={19} /><div><strong>시연용 데모 인증</strong><p>실제 문자를 발송하지 않습니다. 아무 숫자 6자리를 입력해주세요.</p></div></div>
      <form className="au-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="ps-field"><label className="ps-label" htmlFor={codeId}>인증번호</label><label className="search-bar ps-input-bar" htmlFor={codeId}><input id={codeId} className="ps-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="숫자 6자리" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label></div>
        {error && <p className="ps-hint ps-error au-error" role="alert">{error}</p>}
        <button className="upload-button au-submit" type="submit" disabled={busy || code.length !== 6}>{busy ? "인증하는 중이에요" : "인증 완료"}</button>
      </form>
    </main>
  </div>;
}
