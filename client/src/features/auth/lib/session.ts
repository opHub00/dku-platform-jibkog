import { useEffect, useState } from "react";
import { authRepository } from "../api/authRepository";
import type { AuthUser } from "../types";

/**
 * 로그인 상태(앱 전체에서 하나). 화면은 useAuth()로 읽는다.
 * 로그인하면 실시간 이벤트(SSE)를 연결하고, 로그아웃하면 끊는다.
 */
export type AuthState = { user: AuthUser | null; loaded: boolean };

let state: AuthState = { user: null, loaded: false };
const listeners = new Set<(state: AuthState) => void>();
let loading: Promise<void> | null = null;

function setState(next: AuthState): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function getAuthState(): AuthState {
  return state;
}

export function subscribeAuth(listener: (state: AuthState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 서버에 내 정보를 물어 로그인 상태를 맞춘다(처음 한 번, 그리고 401을 받았을 때). */
export function refreshAuth(): Promise<void> {
  loading ??= authRepository
    .me()
    .then((user) => setState({ user, loaded: true }))
    .catch(() => setState({ user: null, loaded: true }))
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await authRepository.login({ email, password });
  setState({ user, loaded: true });
  return user;
}

export async function signup(email: string, password: string, nickname: string): Promise<AuthUser> {
  const user = await authRepository.signup({ email, password, nickname });
  setState({ user, loaded: true });
  return user;
}

export async function logout(): Promise<void> {
  try {
    await authRepository.logout();
  } finally {
    setState({ user: null, loaded: true });
  }
}

export function useAuth(): AuthState {
  const [current, setCurrent] = useState<AuthState>(state);
  useEffect(() => {
    const unsubscribe = subscribeAuth(setCurrent);
    if (!state.loaded) void refreshAuth();
    setCurrent(state);
    return unsubscribe;
  }, []);
  return current;
}
