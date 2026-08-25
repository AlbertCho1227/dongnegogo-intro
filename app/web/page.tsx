import type { Metadata } from "next";
import WebMapApp from "./web-map-app";
import "./web-map.css";

export const metadata: Metadata = {
  title: "웹 버전 | 동네고고",
  description: "Kakao 지도에서 우리 동네의 공공 프로그램과 문화·체육·교육 정보를 찾아보세요.",
  alternates: { canonical: "/web" },
};

async function publicRuntimeConfig() {
  let runtime: Record<string, unknown> = {};
  try {
    const { env } = await import("cloudflare:workers");
    runtime = env as unknown as Record<string, unknown>;
  } catch {
    // Local development resolves values from process.env.
  }
  const value = (...names: string[]) => names
    .map((name) => String(process.env[name] ?? runtime[name] ?? "").trim())
    .find(Boolean) ?? "";
  return {
    kakaoMapKey: value("NEXT_PUBLIC_KAKAO_MAP_JS_KEY"),
    supabaseUrl: value("NEXT_PUBLIC_SUPABASE_URL", "DONGNEGOGO_SUPABASE_URL"),
    supabasePublishableKey: value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY"),
  };
}

export default async function WebVersionPage() {
  const config = await publicRuntimeConfig();
  return <WebMapApp {...config} />;
}
