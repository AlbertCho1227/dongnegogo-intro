export {};
declare global {
  interface Window { kakao?: { maps: { load: (callback: () => void) => void; Map: new (container: HTMLElement, options: object) => KakaoMap; LatLng: new (lat: number, lng: number) => KakaoLatLng; CustomOverlay: new (options: object) => KakaoOverlay; Roadview?: new (container: HTMLElement, options?: object) => KakaoRoadview; RoadviewClient?: new () => KakaoRoadviewClient; event: { addListener: (target: KakaoMap, type: string, handler: () => void) => void; removeListener: (target: KakaoMap, type: string, handler: () => void) => void; }; }; }; }
  interface KakaoLatLng { getLat: () => number; getLng: () => number; }
  interface KakaoMap { setCenter: (position: KakaoLatLng) => void; setLevel: (level: number) => void; getLevel: () => number; getCenter: () => KakaoLatLng; relayout: () => void; }
  interface KakaoRoadview { setPanoId: (panoId: number, position?: KakaoLatLng) => void; }
  interface KakaoRoadviewClient { getNearestPanoId: (position: KakaoLatLng, radius: number, callback: (panoId: number | null) => void) => void; }
  interface KakaoOverlay { setMap: (map: KakaoMap | null) => void; }
}
