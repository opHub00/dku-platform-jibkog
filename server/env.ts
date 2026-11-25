import fs from "node:fs";
import path from "node:path";

export type DotenvKey =
  | "DATABASE_URL"
  | "DATABASE_SEED_DEMO"
  | "AI_PROVIDER"
  | "ANTHROPIC_API_KEY"
  | "GEMINI_API_KEY"
  | "GEMINI_MODEL"
  | "NAVER_CLIENT_ID"
  | "NAVER_CLIENT_SECRET";

/**
 * .env / .env.local 파일에서만 값을 읽는다(.env.local이 .env를 덮어쓴다).
 * 셸 환경변수는 보지 않는다. VITE_ 접두사가 없으므로 클라이언트 번들에는 들어가지 않는다.
 * 요청마다 다시 읽어서 .env를 고친 뒤 서버를 재시작하지 않아도 반영된다.
 */
export function readDotenvValue(envDir: string, name: DotenvKey): string | null {
  let value: string | null = null;
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)\\s*$`);
  for (const file of [".env", ".env.local"]) {
    const fullPath = path.join(envDir, file);
    if (!fs.existsSync(fullPath)) continue;
    for (const line of fs.readFileSync(fullPath, "utf8").split(/\r?\n/)) {
      const match = pattern.exec(line);
      if (!match) continue;
      const parsed = match[1].replace(/^(['"])(.*)\1$/, "$2").trim();
      if (parsed !== "") value = parsed;
    }
  }
  return value;
}
