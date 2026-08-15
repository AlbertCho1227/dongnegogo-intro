import type { Metadata } from "next";
import WebMapApp from "./web-map-app";
import "./web-map.css";

export const metadata: Metadata = {
  title: "웹 버전 | 동네고고",
  description: "Kakao 지도에서 우리 동네의 공공 프로그램과 문화·체육·교육 정보를 찾아보세요.",
  alternates: { canonical: "/web" },
};

async function kakaoMapKey() {
  let key = process.env.NEXT_PUBLIC_KAKAO_MAP_JS_KEY ?? "";
  if (!key) {
    try {
      const { env } = await import("cloudflare:workers");
      key = String((env as unknown as Record<string, unknown>).NEXT_PUBLIC_KAKAO_MAP_JS_KEY ?? "");
    } catch {
      // Local builds resolve the value from .env.local.
    }
  }
  return key;
}

export default async function WebVersionPage() {
  return <WebMapApp kakaoMapKey={await kakaoMapKey()} />;
}

