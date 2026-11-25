/**
 * 카카오 지도 JavaScript SDK에서 쓰는 부분만 적은 타입.
 * https://apis.map.kakao.com/web/documentation/
 */

interface ImportMetaEnv {
  /** 카카오 지도 JavaScript 키(도메인 제한이 걸린 공개 키). 없으면 기존 그림 지도로 보여준다 */
  readonly VITE_KAKAO_MAP_JS_KEY?: string;
}

declare namespace kakao.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }
  class LatLngBounds {
    constructor(sw?: LatLng, ne?: LatLng);
    extend(latlng: LatLng): void;
    getSouthWest(): LatLng;
    getNorthEast(): LatLng;
    isEmpty(): boolean;
  }
  type MapOptions = { center: LatLng; level?: number; maxLevel?: number };
  class Map {
    constructor(container: HTMLElement, options: MapOptions);
    getBounds(): LatLngBounds;
    getCenter(): LatLng;
    getLevel(): number;
    setLevel(level: number, options?: { anchor?: LatLng; animate?: boolean | { duration: number } }): void;
    setCenter(latlng: LatLng): void;
    panTo(latlng: LatLng): void;
    setBounds(bounds: LatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
    setMaxLevel(level: number): void;
    relayout(): void;
  }
  type CustomOverlayOptions = {
    position: LatLng;
    content: HTMLElement | string;
    map?: Map;
    clickable?: boolean;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
  };
  class CustomOverlay {
    constructor(options: CustomOverlayOptions);
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
    setZIndex(zIndex: number): void;
  }
  function load(callback: () => void): void;
  namespace event {
    type Handle = unknown;
    function addListener(target: Map, type: "idle" | "zoom_changed" | "dragend" | "tilesloaded", handler: () => void): void;
    function removeListener(target: Map, type: "idle" | "zoom_changed" | "dragend" | "tilesloaded", handler: () => void): void;
  }
}

interface Window {
  kakao?: { maps: typeof kakao.maps };
}
