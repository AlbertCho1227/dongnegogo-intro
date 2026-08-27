import { NextRequest, NextResponse } from "next/server";
import { fetchWebOpenRunPrograms } from "@/lib/web-program-data";
import { openRunProgramMatchesCity } from "@/lib/open-run-city";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const city = request.nextUrl.searchParams.get("city")?.trim() ?? "";
    const allPrograms = await fetchWebOpenRunPrograms();
    const programs = city ? allPrograms.filter((program) => openRunProgramMatchesCity(program, city)) : allPrograms;
    return NextResponse.json({ programs }, {
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "오픈런 프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
