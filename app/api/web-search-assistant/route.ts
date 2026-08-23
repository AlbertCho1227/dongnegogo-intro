import { NextResponse } from "next/server";
import { fetchWebPlaceSuggestions, fetchWebProgramsNear } from "@/lib/web-program-data";

function numeric(value: string | null): number | null {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "suggest";

  try {
    if (mode === "nearby") {
      const latitude = numeric(url.searchParams.get("latitude"));
      const longitude = numeric(url.searchParams.get("longitude"));
      const radiusKm = numeric(url.searchParams.get("radiusKm"));
      if (latitude === null || longitude === null || radiusKm === null) {
        return NextResponse.json({ programs: [], message: "장소 검색 위치를 확인해 주세요." }, { status: 400 });
      }
      const programs = await fetchWebProgramsNear({ latitude, longitude, radiusKm, limit: 2_000 });
      return NextResponse.json({ programs }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    }

    const query = url.searchParams.get("q")?.trim() ?? "";
    const suggestions = query.length >= 2 ? await fetchWebPlaceSuggestions(query) : [];
    return NextResponse.json({ suggestions }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1_800" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "검색 보조 정보를 불러오지 못했습니다.";
    return NextResponse.json({ suggestions: [], programs: [], message }, { status: 503 });
  }
}
