export {};
declare global {
  interface Window { kakao?: { maps: { load: (callback: () => void) => void; Map: new (container: HTMLElement, options: object) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; CustomOverlay: new (options: object) => KakaoOverlay; event: { addListener: (target: KakaoMap, type: string, handler: () => void) => void; removeListener: (target: KakaoMap, type: string, handler: () => void) => void; }; }; }; }
  interface KakaoLatLng { getLat: () => number; getLng: () => number; }
  interface KakaoMap { setCenter: (position: KakaoLatLng) => void; setLevel: (level: number) => void; getLevel: () => number; getCenter: () => KakaoLatLng; relayout: () => void; }
  interface KakaoOverlay { setMap: (map: KakaoMap | null) => void; }
}
