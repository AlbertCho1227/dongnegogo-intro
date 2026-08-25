import { NextResponse } from "next/server";
import { fetchWebProgramParking } from "@/lib/web-program-data";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id || id.length > 180) {
    return NextResponse.json({ parkingLots: [], message: "프로그램 식별자를 확인해 주세요." }, { status: 400 });
  }
  try {
    const parkingLots = await fetchWebProgramParking(id);
    return NextResponse.json({ parkingLots }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "주차 정보를 불러오지 못했습니다.";
    return NextResponse.json({ parkingLots: [], message }, { status: 503 });
  }
}
