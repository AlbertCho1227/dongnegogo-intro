import { NextResponse } from "next/server";
import { fetchWebOpenRunPrograms } from "@/lib/web-program-data";

export const runtime = "edge";

export async function GET() {
  try {
    const programs = await fetchWebOpenRunPrograms();
    return NextResponse.json({ programs }, {
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "오픈런 프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 502 });
  }
}
