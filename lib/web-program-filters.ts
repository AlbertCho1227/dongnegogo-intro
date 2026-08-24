import type { WebProgram } from "@/lib/web-program-data";
import { programIconName } from "@/lib/web-icon-mapper";

export type WebDetailFilter = {
  label: string;
  iconName: string;
  featured?: boolean;
};

export type WebDetailFilterGroup = {
  title: string;
  emoji: string;
  items: readonly WebDetailFilter[];
};

export const WEB_DETAIL_FILTERS: readonly WebDetailFilter[] = [
  { label: "수영", iconName: "icon_swimming", featured: true },
  { label: "요가", iconName: "icon_yoga", featured: true },
  { label: "필라테스", iconName: "icon_pilates", featured: true },
  { label: "댄스·에어로빅", iconName: "icon_aerobics", featured: true },
  { label: "농구", iconName: "icon_basketball" },
  { label: "테니스", iconName: "icon_tennis", featured: true },
  { label: "골프·게이트볼", iconName: "icon_golf" },
  { label: "배드민턴", iconName: "icon_badminton" },
  { label: "탁구", iconName: "icon_table_tennis", featured: true },
  { label: "축구·풋살·족구", iconName: "icon_football" },
  { label: "야구", iconName: "icon_baseball" },
  { label: "배구", iconName: "icon_volleyball" },
  { label: "볼링", iconName: "icon_bowling" },
  { label: "클라이밍", iconName: "icon_climbing" },
  { label: "무도·태권도", iconName: "icon_martial_arts" },
  { label: "헬스", iconName: "icon_gym_health" },
  { label: "근력·피트니스", iconName: "icon_fitness" },
  { label: "걷기·등산", iconName: "icon_walking_trekking" },
  { label: "체조·스트레칭", iconName: "icon_walking", featured: true },
  { label: "유아·어린이 체육", iconName: "icon_child_activity" },
  { label: "시니어 체육", iconName: "icon_senior_activity" },
  { label: "생활체육 기타", iconName: "icon_sports" },
  { label: "뮤지컬·오페라", iconName: "icon_musical", featured: true },
  { label: "연극", iconName: "icon_theater" },
  { label: "미술·드로잉", iconName: "icon_art_class", featured: true },
  { label: "시각예술·미술관", iconName: "icon_visual_arts" },
  { label: "전시", iconName: "icon_exhibition", featured: true },
  { label: "영화·문화행사", iconName: "icon_culture" },
  { label: "무용·발레", iconName: "icon_dance" },
  { label: "국악", iconName: "icon_traditional_music" },
  { label: "음악·콘서트", iconName: "icon_music", featured: true },
  { label: "축제·행사", iconName: "icon_festival", featured: true },
  { label: "외국어", iconName: "icon_foreign_language", featured: true },
  { label: "컴퓨터·스마트폰·AI", iconName: "icon_digital", featured: true },
  { label: "악기·노래", iconName: "icon_music_class" },
  { label: "요리·베이킹", iconName: "icon_cooking", featured: true },
  { label: "공예·만들기", iconName: "icon_craft" },
  { label: "인문·독서·글쓰기", iconName: "icon_humanities", featured: true },
  { label: "건강·안전·마음돌봄", iconName: "icon_health", featured: true },
  { label: "재테크·취업·창업", iconName: "icon_lifestyle" },
  { label: "공간대여", iconName: "icon_space_rental" },
  { label: "공연장·강당", iconName: "icon_main_auditorium" },
  { label: "박물관", iconName: "icon_museum" },
  { label: "기타", iconName: "icon_other" },
] as const;

/** 운영 카테고리 44개를 누락·중복 없이 사용자에게 익숙한 네 카드로 묶는다. */
export const WEB_DETAIL_FILTER_GROUPS: readonly WebDetailFilterGroup[] = [
  { title: "스포츠·운동", emoji: "🏃", items: WEB_DETAIL_FILTERS.slice(0, 22) },
  { title: "공연·예술", emoji: "🎭", items: WEB_DETAIL_FILTERS.slice(22, 32) },
  { title: "배움·교육", emoji: "📚", items: WEB_DETAIL_FILTERS.slice(32, 39) },
  { title: "생활·공간", emoji: "🏛️", items: WEB_DETAIL_FILTERS.slice(39, 44) },
] as const;

/** 세부 종목은 지도 조회 비용을 제한하기 위해 선택하지 않거나 한 개만 유지한다. */
export function toggleSingleWebDetailFilter(current: readonly string[], label: string): string[] {
  return current.includes(label) ? [] : [label];
}

type PersonaDefinition = {
  label: string;
  emoji: string;
  aliases: readonly string[];
};

export type WebProgramPersonaGroup = {
  title: string;
  items: readonly PersonaDefinition[];
};

export const WEB_PROGRAM_PERSONAS: readonly PersonaDefinition[] = [
  { label: "누구나", emoji: "👥", aliases: ["누구나", "제한없음", "제한 없음", "전체", "모든 시민", "일반"] },
  { label: "영유아", emoji: "👶", aliases: ["영유아", "유아", "미취학", "아기", "베이비"] },
  { label: "어린이", emoji: "🧒", aliases: ["어린이", "아동", "키즈", "유소년"] },
  { label: "초등학생", emoji: "🎒", aliases: ["초등", "초등학생"] },
  { label: "청소년", emoji: "🧑‍🎓", aliases: ["청소년", "중학생", "고등학생", "중고생"] },
  { label: "청년", emoji: "🌱", aliases: ["청년", "대학생", "20대", "30대", "20~30대", "2030"] },
  { label: "성인", emoji: "🧑", aliases: ["성인", "일반인", "만 18세", "19세 이상"] },
  { label: "중장년", emoji: "🧑‍💼", aliases: ["중장년", "중년", "장년", "40대", "50대", "40~50대", "4050", "50플러스"] },
  { label: "시니어", emoji: "👴", aliases: ["시니어", "어르신", "노인", "실버", "60대", "65세", "60대 이상"] },
  { label: "가족", emoji: "👨‍👩‍👧", aliases: ["가족", "가족단위", "가족 단위"] },
  { label: "부모·보호자", emoji: "🫶", aliases: ["부모", "학부모", "보호자", "양육자"] },
  { label: "직장인", emoji: "💼", aliases: ["직장인", "근로자", "재직자"] },
  { label: "여성", emoji: "👩", aliases: ["여성", "여자", "임산부", "엄마"] },
  { label: "남성", emoji: "👨", aliases: ["남성", "남자", "아빠"] },
  { label: "장애인", emoji: "♿", aliases: ["장애인", "장애", "발달장애", "특수교육"] },
  { label: "외국인", emoji: "🌏", aliases: ["외국인", "다문화", "이주민", "결혼이민"] },
  { label: "1인가구", emoji: "🏠", aliases: ["1인가구", "1인 가구", "일인가구", "싱글"] },
  { label: "지역주민", emoji: "📍", aliases: ["지역주민", "지역 주민", "구민", "동 주민", "시민"] },
] as const;

export const WEB_PROGRAM_PERSONA_GROUPS: readonly WebProgramPersonaGroup[] = [
  { title: "연령·세대", items: WEB_PROGRAM_PERSONAS.slice(1, 9) },
  { title: "가족·생활", items: WEB_PROGRAM_PERSONAS.filter((item) => ["누구나", "가족", "부모·보호자", "1인가구"].includes(item.label)) },
  { title: "상황·대상", items: WEB_PROGRAM_PERSONAS.filter((item) => ["직장인", "여성", "남성", "장애인", "외국인", "지역주민"].includes(item.label)) },
] as const;

const DETAIL_ICON_BY_LABEL = new Map(WEB_DETAIL_FILTERS.map((item) => [item.label, item.iconName]));
const PERSONA_BY_LABEL = new Map(WEB_PROGRAM_PERSONAS.map((item) => [item.label, item]));

function personaSearchText(program: WebProgram) {
  return [
    ...program.audiences,
    program.requirement,
    program.name,
    program.summary,
    program.category,
    program.field,
    program.rawCategory,
    program.rawField,
    program.maxClassName,
    program.minClassName,
  ].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR");
}

export function webProgramMatchesFilters(program: WebProgram, detailLabels: readonly string[], personaLabels: readonly string[]) {
  if (detailLabels.length) {
    const iconName = programIconName(program);
    if (!detailLabels.some((label) => DETAIL_ICON_BY_LABEL.get(label) === iconName)) return false;
  }
  if (personaLabels.length) {
    const text = personaSearchText(program);
    const matchesPersona = personaLabels.some((label) => PERSONA_BY_LABEL.get(label)?.aliases.some((alias) => text.includes(alias.toLocaleLowerCase("ko-KR"))));
    if (!matchesPersona) return false;
  }
  return true;
}
