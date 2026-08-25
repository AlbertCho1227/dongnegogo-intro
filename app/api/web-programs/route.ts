import { NextResponse } from "next/server";
import { fetchWebPrograms, fetchWebSearchCandidates } from "@/lib/web-program-data";

function numeric(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const subjectTerms = url.searchParams.getAll("subject");
    const areaTerms = url.searchParams.getAll("area");
    const generalTerms = url.searchParams.getAll("general");
    const ids = url.searchParams.getAll("id");
    const programs = subjectTerms.length || areaTerms.length || generalTerms.length
      ? await fetchWebSearchCandidates({ subjectTerms, areaTerms, generalTerms })
      : await fetchWebPrograms({
      south: numeric(url.searchParams.get("south")),
      west: numeric(url.searchParams.get("west")),
      north: numeric(url.searchParams.get("north")),
      east: numeric(url.searchParams.get("east")),
      limit: numeric(url.searchParams.get("limit")),
      query: url.searchParams.get("q") ?? undefined,
      id: ids.length === 1 ? ids[0] : undefined,
      ids: ids.length > 1 ? ids : undefined,
      });
    return NextResponse.json({ programs }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ programs: [], message }, { status: 503 });
  }
}
