export {};
declare global {
  interface Window { kakao?: { maps: { load: (callback: () => void) => void; Map: new (container: HTMLElement, options: object) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; CustomOverlay: new (options: object) => KakaoOverlay; }; }; }
  interface KakaoLatLng { getLat: () => number; getLng: () => number; }
  interface KakaoMap { setCenter: (position: KakaoLatLng) => void; setLevel: (level: number) => void; getLevel: () => number; getCenter: () => KakaoLatLng; relayout: () => void; }
  interface KakaoOverlay { setMap: (map: KakaoMap | null) => void; }
}
