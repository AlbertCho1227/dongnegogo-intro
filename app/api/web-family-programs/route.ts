import { NextResponse } from "next/server";
import { fetchWebFamilyPrograms } from "@/lib/web-program-data";

export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get("region")?.trim() ?? "";
  if (!region) {
    return NextResponse.json({ programs: [], region: "", radiusMeters: null, regionProgramCount: 0 });
  }
  try {
    const result = await fetchWebFamilyPrograms(region);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가족 프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ programs: [], region, radiusMeters: null, regionProgramCount: 0, message }, { status: 503 });
  }
}
