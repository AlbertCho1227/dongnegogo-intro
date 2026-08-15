import { ImageResponse } from "next/og";

import { OFFICIAL_MAP_ICONS } from "@/lib/official-map-icons";
import { getSharedProgram, type SharedProgram } from "@/lib/program-share-data";

type ImageProps = { params: Promise<{ id: string }> };

export const alt = "동네고고 프로그램 전체 공유 카드";
export const contentType = "image/png";
export const size = { width: 780, height: 1960 };

const MAX_IMAGE_BYTES = 3_500_000;

function cleanID(value: string): string {
  try { return decodeURIComponent(value).trim(); } catch { return value.trim(); }
}

function compact(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trim()}…`;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

async function fetchImageDataURL(rawURL: string | undefined): Promise<string | null> {
  if (!rawURL) return null;
  try {
    const url = new URL(rawURL);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(2_500) });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!contentType?.startsWith("image/") || contentType === "image/svg+xml") return null;
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_IMAGE_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return `data:${contentType};base64,${base64(bytes)}`;
  } catch {
    return null;
  }
}

function categorySymbol(program: SharedProgram): string {
  const value = `${program.category} ${program.field} ${program.name}`;
  if (/수영|아쿠아/.test(value)) return "🏊";
  if (/전시|미술|공예/.test(value)) return "🎨";
  if (/공연|연극|뮤지컬/.test(value)) return "🎭";
  if (/음악|악기|노래/.test(value)) return "🎵";
  if (/체육|운동|요가|필라테스/.test(value)) return "🏃";
  if (/교육|강좌|학습|외국어/.test(value)) return "📚";
  return "🌿";
}

function deadlineCopy(program: SharedProgram): string {
  if (!program.receiptEnd) return program.status === "접수중"
    ? "지금 신청할 수 있어요."
    : "접수 일정을 확인해 주세요.";
  const end = new Date(program.receiptEnd);
  if (!Number.isFinite(end.getTime())) return "접수 일정을 확인해 주세요.";
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "접수가 마감되었어요.";
  if (days === 0) return "오늘 마감해요.";
  return `마감까지 ${days}일 남았어요.`;
}

function pill(text: string, color = "#14884d", background = "#ecf8e9") {
  return (
    <span style={{
      display: "flex", padding: "9px 14px", borderRadius: 12,
      color, background, fontSize: 22, fontWeight: 800, lineHeight: 1,
    }}>{text}</span>
  );
}

export default async function ProgramShareImage({ params }: ImageProps) {
  const { id } = await params;
  const program = await getSharedProgram(cleanID(id)).catch(() => null);
  if (!program) return new Response("Program not found", { status: 404 });

  const posterURL = program.images[0]?.thumbnailUrl ?? program.images[0]?.url;
  const audience = program.audiences.slice(0, 2).join(" · ");
  const place = [program.area, program.facility, program.room]
    .filter((value, index, items) => value && items.indexOf(value) === index)
    .join(" · ");
  const poster = await fetchImageDataURL(posterURL);
  const marker = categorySymbol(program);

  return new ImageResponse(
    <div style={{
      display: "flex", width: "100%", height: "100%", flexDirection: "column",
      overflow: "hidden", color: "#153b29", background: "#087a42",
      fontFamily: "sans-serif",
    }}>
      <div style={{
        display: "flex", height: 630, flexDirection: "column", alignItems: "center",
        padding: "68px 52px 86px", borderRadius: "0 0 92px 92px", background: "#f7f4e9",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40, color: "#0d7542", fontSize: 30, fontWeight: 800 }}>
          <span style={{
            display: "flex", width: 70, height: 70, flex: "none", flexDirection: "column",
            alignItems: "center", justifyContent: "center", borderRadius: 16,
            color: "#fff", background: "#55be45", fontSize: 19, fontWeight: 900,
            lineHeight: 1.02, boxShadow: "0 6px 14px rgba(17,97,54,.18)",
          }}><span>동네</span><span>고고</span></span>
          <span>동네고고에서 찾았어요.</span>
        </div>
        <div style={{
          display: "flex", width: 490, height: 390, alignItems: "center", justifyContent: "center",
          overflow: "hidden", borderRadius: 10, background: "rgba(255,255,255,.68)",
        }}>
          {poster ? (
            <img src={poster} alt="" width={490} height={390} style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, color: "#53705e", fontSize: 24 }}>
              <span style={{
                display: "flex", width: 118, height: 118, flexDirection: "column", alignItems: "center",
                justifyContent: "center", borderRadius: 26, color: "#fff", background: "#55be45",
                fontSize: 27, fontWeight: 900, lineHeight: 1.02,
              }}><span>동네</span><span>고고</span></span>
              <span>프로그램 이미지를 준비하고 있어요</span>
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: "flex", margin: "-50px 44px 0", padding: "32px 34px 34px",
        flexDirection: "column", border: "2px solid #d8dfd7", borderRadius: 42,
        background: "#ffffff", boxShadow: "0 16px 36px rgba(4,75,38,.18)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {pill(program.isFree ? "무료" : compact(program.feeText, 18))}
            {pill(program.status)}
            {audience ? pill(compact(audience, 22), "#7254c6", "#f0ebff") : null}
          </div>
          <div style={{ display: "flex", flex: "none", gap: 12 }}>
            <span style={{ display: "flex", width: 64, height: 64, alignItems: "center", justifyContent: "center", border: "4px solid #1caf61", borderRadius: 32, background: "#fff" }}>
              <span style={{ fontSize: 34 }}>{marker}</span>
            </span>
            <span style={{ display: "flex", width: 64, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 32, color: "#fff", background: "#1caf61", fontSize: 24, fontWeight: 900 }}>지도</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 18, color: "#141c17", fontSize: 39, fontWeight: 900, lineHeight: 1.24, letterSpacing: -1.3 }}>
          {compact(program.name, 74)}
        </div>
        <div style={{ display: "flex", marginTop: 13, color: "#626e66", fontSize: 24, lineHeight: 1.42 }}>
          {compact(place, 82)}
        </div>
        <div style={{ display: "flex", width: "100%", height: 2, margin: "28px 0 22px", background: "#e6ebe6" }} />
        <div style={{ display: "flex", color: "#0b7040", fontSize: 34, fontWeight: 900 }}>이 프로그램은요</div>
        <div style={{ display: "flex", marginTop: 13, color: "#20352a", fontSize: 25, lineHeight: 1.52 }}>
          {compact(program.description, 245)}
        </div>
        <div style={{ display: "flex", width: "100%", height: 2, margin: "27px 0 19px", background: "#e6ebe6" }} />
        <div style={{ display: "flex", color: "#394b40", fontSize: 23, fontWeight: 700 }}>📍 {compact(program.address ?? place, 80)}</div>
        <div style={{ display: "flex", marginTop: 14, color: "#394b40", fontSize: 23, fontWeight: 700 }}>🗓️ 신청 일정은 상세 페이지에서 확인해 주세요.</div>
      </div>

      <div style={{
        display: "flex", margin: "26px 44px 0", padding: "24px", flexDirection: "column",
        alignItems: "center", border: "2px solid rgba(255,255,255,.48)", borderRadius: 26,
        color: "#fff", background: "rgba(255,255,255,.22)", fontSize: 25, lineHeight: 1.45,
      }}>
        <strong style={{ fontSize: 28 }}>{deadlineCopy(program)}</strong>
        <span>알림을 켜두면 놓치지 않아요.</span>
      </div>

      <div style={{
        display: "flex", minHeight: 94, margin: "24px 44px 0", alignItems: "center",
        justifyContent: "center", borderRadius: 26, color: "#0a6339", background: "#fff",
        fontSize: 29, fontWeight: 900,
      }}>📍 ‘동네고고’ 앱 이동은 여기서</div>

      <div style={{
        display: "flex", margin: "24px 28px 0", padding: "28px", flexDirection: "column",
        borderRadius: 34, background: "#f7f4e9",
      }}>
        <div style={{ display: "flex", color: "#123c29", fontSize: 34, fontWeight: 900 }}>지도 바로가기</div>
        <div style={{ display: "flex", marginTop: 6, color: "#657269", fontSize: 21 }}>원하는 지도 앱에서 목적지 위치와 가는 길을 확인하세요.</div>
        <div style={{ display: "flex", marginTop: 18, gap: 12 }}>
          {[
            { icon: OFFICIAL_MAP_ICONS.kakao.dataURL, name: "카카오 지도" },
            { icon: OFFICIAL_MAP_ICONS.naver.dataURL, name: "네이버 지도" },
            { icon: OFFICIAL_MAP_ICONS.google.dataURL, name: "구글 지도" },
          ].map((map) => (
            <div key={map.name} style={{
              display: "flex", minHeight: 82, flex: 1, alignItems: "center", justifyContent: "center",
              gap: 10, border: "2px solid #dde3da", borderRadius: 20, color: "#1d2d23",
              background: "#fff", fontSize: 21, fontWeight: 800,
            }}>
              <img src={map.icon} alt="" width={42} height={42} style={{ objectFit: "contain", borderRadius: 10 }} />
              <span>{map.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", marginTop: "auto", padding: "22px 24px 30px", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.76)", fontSize: 18 }}>
        데이터 출처·이용정책　·　개인정보처리방침
      </div>
    </div>,
    {
      ...size,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
    },
  );
}
