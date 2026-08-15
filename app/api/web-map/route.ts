import { NextResponse } from "next/server";
import { fetchWebMapViewport, type WebMapCluster } from "@/lib/web-program-data";

function numeric(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scope(value: string | null): WebMapCluster["scope"] {
  if (value === "neighborhood" || value === "district" || value === "city" || value === "province") return value;
  return "localArea";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const south = numeric(url.searchParams.get("south"));
  const west = numeric(url.searchParams.get("west"));
  const north = numeric(url.searchParams.get("north"));
  const east = numeric(url.searchParams.get("east"));
  if (south === null || west === null || north === null || east === null) {
    return NextResponse.json({ message: "지도 경계를 확인해 주세요." }, { status: 400 });
  }
  try {
    const result = await fetchWebMapViewport({
      south, west, north, east,
      previousMode: url.searchParams.get("previousMode") === "cluster" ? "cluster" : "individual",
      scope: scope(url.searchParams.get("scope")),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "지도 프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 503 });
  }
}
