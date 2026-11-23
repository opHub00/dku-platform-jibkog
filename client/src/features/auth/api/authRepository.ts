import type { AuthUser } from "../types";
import { apiRequest, AuthRequiredError, field } from "./httpClient";

/** 로그인 저장소 인터페이스. 지금은 개발 서버 API(docs/api.md)를 부른다. */
export interface AuthRepository {
  /** 로그인 안 했으면 null */
  me(): Promise<AuthUser | null>;
  signup(input: { email: string; password: string; nickname: string }): Promise<AuthUser>;
  login(input: { email: string; password: string }): Promise<AuthUser>;
  logout(): Promise<void>;
}

function parseUser(value: unknown): AuthUser {
  const user = field(value, "user");
  const id = field(user, "id");
  const email = field(user, "email");
  const nickname = field(user, "nickname");
  const realName = field(user, "realName");
  const identityVerified = field(user, "identityVerified");
  if (typeof id !== "number" || typeof email !== "string" || typeof nickname !== "string" || typeof identityVerified !== "boolean" || (realName !== null && typeof realName !== "string")) {
    throw new Error("사용자 정보 형식이 올바르지 않아요");
  }
  return { id, email, nickname, realName, identityVerified };
}

export function createHttpAuthRepository(): AuthRepository {
  return {
    async me() {
      try {
        return parseUser(await apiRequest("/api/auth/me"));
      } catch (error) {
        if (error instanceof AuthRequiredError) return null;
        throw error;
      }
    },
    async signup(input) {
      return parseUser(await apiRequest("/api/auth/signup", { method: "POST", body: input }));
    },
    async login(input) {
      return parseUser(await apiRequest("/api/auth/login", { method: "POST", body: input }));
    },
    async logout() {
      await apiRequest("/api/auth/logout", { method: "POST", body: {} });
    },
  };
}

export const authRepository: AuthRepository = createHttpAuthRepository();
