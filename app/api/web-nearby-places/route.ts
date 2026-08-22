import { NextResponse } from "next/server";
import { fetchWebNearbyPlaces } from "@/lib/web-program-data";

function number(value: string | null): number | null {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = number(params.get("latitude"));
  const longitude = number(params.get("longitude"));
  const radiusMeters = number(params.get("radiusMeters"));
  if (latitude === null || longitude === null || radiusMeters === null) {
    return NextResponse.json({ message: "목적지와 반경을 확인해 주세요." }, { status: 400 });
  }
  try {
    const summary = await fetchWebNearbyPlaces({ latitude, longitude, radiusMeters });
    return NextResponse.json(summary, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (error) {
    return NextResponse.json({ places: [], mapPlaces: [], totalCount: 0, categoryCounts: {}, isComplete: true, message: error instanceof Error ? error.message : "주변 가게를 불러오지 못했습니다." }, { status: 503 });
  }
}
