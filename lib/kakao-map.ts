let kakaoPromise: Promise<boolean> | null = null;

export function loadKakaoMap(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao?.maps.load(() => resolve(true)));
  if (kakaoPromise) return kakaoPromise;
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY;
  if (!key) return Promise.resolve(false);
  kakaoPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=clusterer,services`;
    script.async = true; script.onload = () => window.kakao?.maps.load(() => resolve(true)); script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return kakaoPromise;
}
