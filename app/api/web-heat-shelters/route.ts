import { NextResponse } from "next/server";
import { fetchWebHeatShelters } from "@/lib/web-program-data";

function number(value: string | null): number | null {
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const south = number(params.get("south"));
  const west = number(params.get("west"));
  const north = number(params.get("north"));
  const east = number(params.get("east"));
  const centerLatitude = number(params.get("centerLatitude"));
  const centerLongitude = number(params.get("centerLongitude"));
  if ([south, west, north, east, centerLatitude, centerLongitude].some((value) => value === null)) {
    return NextResponse.json({ message: "지도 경계를 확인해 주세요." }, { status: 400 });
  }
  try {
    const shelters = await fetchWebHeatShelters({ south: south!, west: west!, north: north!, east: east!, centerLatitude: centerLatitude!, centerLongitude: centerLongitude! });
    return NextResponse.json({ shelters }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch (error) {
    return NextResponse.json({ shelters: [], message: error instanceof Error ? error.message : "무더위쉼터를 불러오지 못했습니다." }, { status: 503 });
  }
}
