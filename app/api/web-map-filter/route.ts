import { NextResponse } from "next/server";
import { fetchWebMapFilterCatalog } from "@/lib/web-program-data";

type FilterRequest = {
  details?: string[];
  personas?: string[];
  fields?: string[];
  audiences?: string[];
  fee?: string | null;
  statuses?: string[];
  todayOnly?: boolean;
  originLatitude?: number | null;
  originLongitude?: number | null;
  radiusMeters?: number | null;
  south?: number | null;
  west?: number | null;
  north?: number | null;
  east?: number | null;
};

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 48)
    : [];
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as FilterRequest;
    const result = await fetchWebMapFilterCatalog({
      details: strings(body.details),
      personas: strings(body.personas),
      fields: strings(body.fields),
      audiences: strings(body.audiences),
      fee: typeof body.fee === "string" ? body.fee : null,
      statuses: strings(body.statuses),
      todayOnly: body.todayOnly === true,
      originLatitude: numberOrNull(body.originLatitude),
      originLongitude: numberOrNull(body.originLongitude),
      radiusMeters: numberOrNull(body.radiusMeters),
      south: numberOrNull(body.south),
      west: numberOrNull(body.west),
      north: numberOrNull(body.north),
      east: numberOrNull(body.east),
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "조건 프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ programs: [], message }, { status: 503 });
  }
}
