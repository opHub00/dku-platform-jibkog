import type { Complex } from "../types";

export type ResaleRestriction =
  | { restricted: false; endsOn: string | null }
  | { restricted: true; endsOn: string; daysLeft: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "YYYY-MM-DD"를 로컬 자정 기준으로 해석한다. */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 전매제한 상태를 확인한다. 해제일 당일부터 거래할 수 있다고 본다.
 */
export function getResaleRestriction(
  complex: Complex,
  now: Date = new Date(),
): ResaleRestriction {
  const endsOn = complex.resaleRestrictionEndsOn;
  if (endsOn === null) return { restricted: false, endsOn: null };

  const daysLeft = Math.ceil(
    (startOfDay(parseLocalDate(endsOn)) - startOfDay(now)) / DAY_MS,
  );
  if (daysLeft <= 0) return { restricted: false, endsOn };
  return { restricted: true, endsOn, daysLeft };
}

export function isResaleRestricted(
  complex: Complex,
  now: Date = new Date(),
): boolean {
  return getResaleRestriction(complex, now).restricted;
}
