/**
 * 카카오 지도 SDK를 한 번만 불러온다.
 * 키가 없거나, 스크립트가 막히거나(도메인 미등록·네트워크), 제한 시간 안에 준비되지 않으면 실패한다.
 * 실패하면 화면은 기존 그림 지도로 대신 보여준다.
 */

const SDK_URL = "https://dapi.kakao.com/v2/maps/sdk.js";
const LOAD_TIMEOUT_MS = 8000;

export class KakaoMapUnavailableError extends Error {
  constructor(readonly reason: "no-key" | "load-failed" | "timeout") {
    super(reason === "no-key" ? "카카오 지도 키가 없어요" : "카카오 지도를 불러오지 못했어요");
    this.name = "KakaoMapUnavailableError";
  }
}

export function kakaoMapKey(): string | null {
  const key = import.meta.env.VITE_KAKAO_MAP_JS_KEY;
  return typeof key === "string" && key.trim() !== "" ? key.trim() : null;
}

let pending: Promise<typeof kakao.maps> | null = null;

export function loadKakaoMaps(): Promise<typeof kakao.maps> {
  if (pending) return pending;
  const key = kakaoMapKey();
  if (!key) return Promise.reject(new KakaoMapUnavailableError("no-key"));

  pending = new Promise<typeof kakao.maps>((resolve, reject) => {
    const ready = () => {
      const maps = window.kakao?.maps;
      if (!maps) return reject(new KakaoMapUnavailableError("load-failed"));
      // autoload=false로 불렀으므로 load 콜백 뒤에 Map 등을 쓸 수 있다
      maps.load(() => resolve(maps));
    };
    if (window.kakao?.maps) {
      ready();
      return;
    }
    const script = document.createElement("script");
    script.src = `${SDK_URL}?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    const timer = window.setTimeout(() => reject(new KakaoMapUnavailableError("timeout")), LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      ready();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new KakaoMapUnavailableError("load-failed"));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // 다음에 다시 시도할 수 있게 비운다
    pending = null;
    throw error;
  });
  return pending;
}
