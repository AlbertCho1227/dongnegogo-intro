import { NextResponse } from "next/server";
import { fetchWebRoute, type WebRouteMode } from "@/lib/web-route-data";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function coordinate(value: unknown) {
  const row = record(value);
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function mode(value: unknown): WebRouteMode | null {
  return value === "WALKING" || value === "TRANSIT" || value === "DRIVING" ? value : null;
}

export async function POST(request: Request) {
  try {
    const body = record(await request.json());
    const routeMode = mode(body.mode);
    const origin = coordinate(body.origin);
    const destination = coordinate(body.destination);
    if (!routeMode || !origin || !destination) {
      return NextResponse.json({ message: "출발지·목적지·이동수단을 확인해 주세요." }, { status: 400 });
    }
    const route = await fetchWebRoute({
      mode: routeMode,
      origin,
      destination,
      destinationName: typeof body.destinationName === "string" ? body.destinationName : undefined,
    });
    return NextResponse.json(route, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "실제 경로를 불러오지 못했어요.",
    }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
