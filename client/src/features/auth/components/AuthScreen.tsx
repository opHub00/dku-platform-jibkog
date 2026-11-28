import { useId, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { login, signup } from "../lib/session";
import type { AuthUser } from "../types";
// 입력칸은 매물 등록 화면과 같은 스타일(ps-)을 쓴다
import "@/features/presale/presale.css";
import "../auth.css";

type Mode = "login" | "signup";

export function AuthScreen({
  reason,
  onClose,
  onDone,
}: {
  /** 왜 로그인이 필요한지(예: "채팅하려면 로그인이 필요해요") */
  reason?: string;
  onClose: () => void;
  onDone: (user: AuthUser, mode: Mode) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [realName, setRealName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const nicknameId = useId();
  const realNameId = useId();

  async function submit() {
    if (busy) return;
    setError(null);
    if (email.trim() === "" || password === "") return setError("이메일과 비밀번호를 입력해주세요");
    if (mode === "signup" && password.length < 8) return setError("비밀번호는 8자 이상으로 정해주세요");
    if (mode === "signup" && (nickname.trim().length < 2 || nickname.trim().length > 12)) return setError("닉네임은 2~12자로 정해주세요");
    if (mode === "signup" && (realName.trim().length < 2 || realName.trim().length > 30)) return setError("실명은 2~30자로 입력해주세요");
    setBusy(true);
    try {
      const user = mode === "login" ? await login(email.trim(), password) : await signup(email.trim(), password, nickname.trim(), realName.trim());
      onDone(user, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 시도해주세요");
      setBusy(false);
    }
  }

  return (
    <div className="detail-screen">
      <header className="page-header">
        <div>
          <p className="eyebrow">집콕 계정</p>
          <h1>{mode === "login" ? "로그인해주세요" : "회원가입"}</h1>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="로그인 닫기">
          <X size={19} />
        </button>
      </header>

      <main className="detail-body">
        {reason && (
          <div className="safety-note au-reason">
            <ShieldCheck size={19} />
            <div>
              <strong>{reason}</strong>
              <p>매물 등록·찜·채팅은 로그인한 뒤에 쓸 수 있어요.</p>
            </div>
          </div>
        )}

        <div className="segment-control">
          <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); }}>로그인</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(null); }}>회원가입</button>
        </div>

        <form
          className="au-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="ps-field">
            <label className="ps-label" htmlFor={emailId}>이메일</label>
            <label className="search-bar ps-input-bar" htmlFor={emailId}>
              <input id={emailId} className="ps-input" type="email" autoComplete="email" placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <div className="ps-field">
            <label className="ps-label" htmlFor={passwordId}>비밀번호</label>
            <label className="search-bar ps-input-bar" htmlFor={passwordId}>
              <input id={passwordId} className="ps-input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "8자 이상" : ""} value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </div>
          {mode === "signup" && (
            <>
              <div className="ps-field">
                <label className="ps-label" htmlFor={realNameId}>실명</label>
                <label className="search-bar ps-input-bar" htmlFor={realNameId}>
                  <input id={realNameId} className="ps-input" autoComplete="name" maxLength={30} placeholder="계약서에 적힌 이름을 입력해주세요" value={realName} onChange={(e) => setRealName(e.target.value)} />
                </label>
                <p className="ps-hint">다른 사람에게는 가운데 글자를 가려서 보여드려요.</p>
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor={nicknameId}>닉네임</label>
                <label className="search-bar ps-input-bar" htmlFor={nicknameId}>
                  <input id={nicknameId} className="ps-input" maxLength={12} placeholder="채팅에서 상대에게 보이는 이름이에요" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                </label>
              </div>
            </>
          )}
          {error && <p className="ps-hint ps-error au-error" role="alert">{error}</p>}
          <button className="upload-button au-submit" type="submit" disabled={busy}>
            {busy ? "확인하는 중이에요" : mode === "login" ? "로그인" : "가입하고 시작하기"}
          </button>
        </form>

        <p className="sheet-footnote">
          <ShieldCheck size={12} /> 비밀번호는 암호화해서 저장하고, 로그인 정보는 이 브라우저 쿠키에만 남아요
        </p>
        {import.meta.env.DEV && mode === "login" && (
          <p className="au-dev-hint">개발용 시드 계정: seller1@jibkog.dev ~ seller5@jibkog.dev / jibkog-demo-1234</p>
        )}
      </main>
    </div>
  );
}
