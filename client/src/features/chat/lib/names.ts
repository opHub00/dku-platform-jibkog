/** 아바타 두 글자: 세 글자 한글 이름은 성을 뺀다 */
export function avatarText(name: string): string {
  const trimmed = name.trim();
  return /^[가-힣]{3}$/.test(trimmed) ? trimmed.slice(1) : trimmed.slice(0, 2);
}

export const ROLE_LABELS = { buyer: "구매자", seller: "판매자" } as const;
