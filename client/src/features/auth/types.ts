/**
 * 로그인 사용자. 서버(server/api)와 함께 쓰므로 "@/" 경로 import를 두지 않는다.
 */
export type AuthUser = {
  id: number;
  email: string;
  nickname: string;
  realName: string | null;
  identityVerified: boolean;
};

/** API 오류 응답 본문: { error: { code, message } } */
export type ApiErrorBody = { error: { code: string; message: string } };
