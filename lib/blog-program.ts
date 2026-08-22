import type { SharedProgram } from "@/lib/program-share-data";

export const BLOG_PROGRAM_CATEGORIES = ["교육", "문화", "전시", "체육", "문화행사"] as const;

const PARKING_PATTERN = /주차장|공영\s*주차|주차\s*시설|parking/i;
const SWIMMING_PATTERN = /수영|아쿠아|물놀이/;
const PERFORMANCE_PATTERN = /공연|연극|뮤지컬|콘서트|오페라|무용|발레|국악|연주/;
const EXHIBITION_PATTERN = /전시|미술|그림|사진전|박물관|미술관|공예/;
const HOBBY_PATTERN = /취미|체험|공방|만들기|요리|원예|도예|서예|바둑|보드게임|악기|뜨개/;
const EVENT_PATTERN = /행사|축제|페스티벌|마켓|박람회/;
const SPORTS_PATTERN = /체육|운동|수영|축구|야구|농구|테니스|배드민턴|요가|필라테스|댄스|빙상|탁구/;
const EDUCATION_PATTERN = /교육|강좌|강의|수업|학습|교실|아카데미|코딩|외국어|문해/;

export type BlogProgramKind = "교육·강좌" | "공연·연극·뮤지컬" | "전시·예술" | "문화·행사" | "체육·수영" | "취미·체험";
export type BlogAccent = "lime" | "violet" | "blue";

function searchable(program: Pick<SharedProgram, "name" | "category" | "field" | "facility" | "maxClassName" | "minClassName">): string {
  return [program.name, program.category, program.field, program.facility, program.maxClassName, program.minClassName]
    .filter(Boolean)
    .join(" ");
}

export function isParkingProgram(program: Pick<SharedProgram, "name" | "category" | "field" | "facility" | "maxClassName" | "minClassName">): boolean {
  return PARKING_PATTERN.test(searchable(program));
}

export function isBlogProgram(program: Pick<SharedProgram, "name" | "category" | "field" | "facility" | "maxClassName" | "minClassName">): boolean {
  return BLOG_PROGRAM_CATEGORIES.includes(program.category as (typeof BLOG_PROGRAM_CATEGORIES)[number]) && !isParkingProgram(program);
}

export function blogProgramKind(program: Pick<SharedProgram, "name" | "category" | "field" | "facility" | "maxClassName" | "minClassName">): BlogProgramKind {
  const value = searchable(program);
  if (SWIMMING_PATTERN.test(value)) return "체육·수영";
  if (PERFORMANCE_PATTERN.test(value)) return "공연·연극·뮤지컬";
  if (EXHIBITION_PATTERN.test(value) || program.category === "전시") return "전시·예술";
  if (SPORTS_PATTERN.test(value) || program.category === "체육") return "체육·수영";
  if (HOBBY_PATTERN.test(value)) return "취미·체험";
  if (EVENT_PATTERN.test(value) || program.category === "문화행사") return "문화·행사";
  if (EDUCATION_PATTERN.test(value) || program.category === "교육") return "교육·강좌";
  return "취미·체험";
}

export function blogProgramAccent(kind: BlogProgramKind): BlogAccent {
  if (kind === "체육·수영") return "blue";
  if (kind === "전시·예술" || kind === "공연·연극·뮤지컬" || kind === "문화·행사") return "violet";
  return "lime";
}

export function blogProgramIcon(kind: BlogProgramKind): string {
  if (kind === "체육·수영") return kind.includes("수영") ? "/markers/icon_swimming.png" : "/markers/icon_sports.png";
  if (kind === "전시·예술") return "/markers/icon_exhibition.png";
  if (kind === "공연·연극·뮤지컬") return "/markers/icon_theater.png";
  if (kind === "문화·행사") return "/markers/icon_culture.png";
  return "/markers/icon_digital.png";
}

export function blogProgramURL(id: string): string {
  return `https://www.dongnegogo.com/blog/program/${encodeURIComponent(id)}`;
}

export function isProgramEnded(program: Pick<SharedProgram, "lectureEnd" | "status">, now = new Date()): boolean {
  if (program.lectureEnd) {
    const end = new Date(program.lectureEnd);
    if (Number.isFinite(end.getTime()) && end.getTime() < now.getTime()) return true;
  }
  return /종료|마감|완료|폐강/.test(program.status);
}

export function isIndexableBlogProgram(program: SharedProgram): boolean {
  return isBlogProgram(program)
    && Boolean(program.area && program.facility && program.source)
    && Boolean(program.images.length)
    && Boolean(program.lectureStart || program.periodText || program.scheduleText || program.receiptEnd)
    && program.name.length >= 4;
}

function compact(value: string, max = 54): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trim()}…`;
}

export function programLongTailTitle(program: SharedProgram): string {
  const kind = blogProgramKind(program);
  const region = program.area || "우리 동네";
  const cost = program.isFree ? "무료 " : "";
  return `${region} ${cost}${kind} ${compact(program.name)} 일정·신청 가이드`;
}

export function programDescription(program: SharedProgram): string {
  const kind = blogProgramKind(program);
  const ended = isProgramEnded(program);
  return `${program.area} ${program.facility}의 ${program.name} ${kind} 정보를 정리했습니다. ${ended ? "종료된 일정도 기록으로 보존하며" : "기간·비용·대상·신청 방법과"} 실제 프로그램·시설 사진 및 출처를 함께 확인하세요.`;
}

export function koreanDateOnly(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric",
  }).format(date);
}

export function visibleSource(image: SharedProgram["images"][number], fallback: string | null): string {
  return image.attribution || fallback || "운영기관 공개 이미지";
}
