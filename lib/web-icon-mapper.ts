import type { WebProgram } from "@/lib/web-program-data";

type Rule = readonly [icon: string, keywords: readonly string[]];

const RULES: readonly Rule[] = [
  ["icon_heat_shelter", ["무더위쉼터", "무더위 쉼터", "폭염쉼터", "폭염 쉼터", "더위쉼터", "더위 쉼터"]],
  ["icon_senior_activity", ["어르신체육활동사업", "어르신 체육활동사업", "어르신 체육 활동 사업"]],
  ["icon_space_rental", ["공간대여", "공간 대여", "시설대여", "시설 대여", "장소대관", "장소 대관", "대관", "강당", "회의실", "세미나실", "다목적실", "공유공간", "공유 공간"]],
  ["icon_swimming", ["수영", "수영장", "아쿠아", "아쿠아로빅", "물놀이"]],
  ["icon_yoga", ["요가"]],
  ["icon_pilates", ["필라테스", "필라테쓰"]],
  ["icon_aerobics", ["에어로빅", "줌바", "라인댄스", "댄스스포츠", "댄스"]],
  ["icon_basketball", ["농구"]], ["icon_tennis", ["테니스", "정구"]],
  ["icon_golf", ["골프", "스크린골프"]], ["icon_badminton", ["배드민턴"]],
  ["icon_table_tennis", ["탁구"]], ["icon_football", ["축구", "풋살", "족구"]],
  ["icon_baseball", ["야구", "티볼"]], ["icon_volleyball", ["배구"]],
  ["icon_bowling", ["볼링"]], ["icon_climbing", ["클라이밍", "암벽", "스포츠클라이밍"]],
  ["icon_martial_arts", ["태권도", "합기도", "검도", "유도", "복싱", "무술", "격투"]],
  ["icon_gym_health", ["헬스"]],
  ["icon_walking_trekking", ["걷기", "걷는", "트레킹", "등산", "산책", "둘레길", "워킹", "하이킹"]],
  ["icon_walking", ["건강체조", "생활체조", "체조", "스트레칭", "운동"]],
  ["icon_fitness", ["피트니스", "근력", "웨이트", "다이어트", "체력"]],
  ["icon_musical", ["뮤지컬", "오페라"]], ["icon_theater", ["연극", "연희", "마당극", "극단"]],
  ["icon_art_class", ["그림", "드로잉", "수채화", "서양화", "캘리그라피", "캘리그래피", "한국화", "민화", "서예", "미술교실", "미술 교실", "미술수업", "미술 수업", "미술강좌", "미술 강좌", "미술클래스", "미술 클래스", "미술교육", "미술 교육", "미술체험", "미술 체험", "미술프로그램", "미술 프로그램"]],
  ["icon_visual_arts", ["미술관", "미술작품", "미술 작품", "미술전시", "미술 전시", "미술감상", "미술 감상", "예술작품", "예술 작품", "예술전시", "예술 전시", "예술감상", "예술 감상", "예술프로그램", "예술 프로그램", "예술체험", "예술 체험", "예술활동", "예술 활동", "시각예술", "시각 예술", "현대미술", "현대 미술", "회화전", "회화 전시", "조각전", "조각 전시", "조형예술", "조형 예술", "동상", "아트페어", "아트 페어", "비엔날레"]],
  ["icon_exhibition", ["전시", "전람", "상설전", "기획전", "사진전", "작품전", "갤러리"]],
  ["icon_culture", ["영화", "시네마", "상영", "문화행사", "문화 행사"]],
  ["icon_dance", ["무용", "발레", "현대무용", "한국무용"]],
  ["icon_traditional_music", ["국악", "판소리", "사물놀이", "풍물", "민요", "농악", "장구", "난타"]],
  ["icon_music", ["음악", "콘서트", "연주", "오케스트라", "클래식", "재즈", "합창", "밴드", "가요"]],
  ["icon_festival", ["행사", "축제", "페스티벌", "마켓", "플리마켓"]],
  ["icon_culture", ["문화·공연", "문화/공연", "문화공연", "문화 공연", "공연"]],
  ["icon_foreign_language", ["영어", "중국어", "일본어", "외국어", "한국어", "프랑스어", "스페인어", "language"]],
  ["icon_digital", ["컴퓨터", "디지털", "스마트폰", "코딩", "인공지능", "AI", "바이브코딩", "메타버스", "로봇"]],
  ["icon_art_class", ["미술"]],
  ["icon_music_class", ["피아노", "악기", "통기타", "클래식기타", "어쿠스틱기타", "일렉기타", "기타교실", "기타연주", "우쿨렐레", "바이올린", "첼로", "플루트", "오카리나", "하모니카", "색소폰", "음악교실", "노래교실"]],
  ["icon_cooking", ["요리", "베이킹", "제과", "제빵", "바리스타", "커피", "쿠킹"]],
  ["icon_craft", ["공예", "만들기", "도예", "목공", "가죽", "뜨개", "자수", "재봉", "미싱", "퀼트", "매듭", "양재", "홈패션", "의상", "비누", "향수", "플라워"]],
  ["icon_humanities", ["인문", "역사", "철학", "문화유산", "독서", "글쓰기", "문학", "시민교육", "강좌", "강의", "교육", "학습", "교실", "아카데미", "특강", "세미나", "워크숍"]],
  ["icon_health", ["건강", "복지", "심리", "명상", "치매", "응급", "심폐소생술", "안전"]],
  ["icon_lifestyle", ["재테크", "금융", "부동산", "취업", "창업", "일자리", "자립", "반려동물"]],
];

const SPORTS = new Set(["icon_swimming", "icon_yoga", "icon_pilates", "icon_aerobics", "icon_basketball", "icon_tennis", "icon_golf", "icon_badminton", "icon_table_tennis", "icon_football", "icon_baseball", "icon_volleyball", "icon_bowling", "icon_climbing", "icon_martial_arts", "icon_fitness", "icon_gym_health", "icon_walking", "icon_walking_trekking", "icon_child_activity", "icon_senior_activity", "icon_sports"]);

function normalize(value: string | null | undefined) { return (value ?? "").normalize("NFC").trim().replace(/\s+/g, " "); }
function compact(value: string | null | undefined) { return normalize(value).replace(/[^가-힣A-Za-z0-9]/g, "").toLowerCase(); }
function matches(keyword: string, text: string) {
  if (keyword === "AI") return /(^|[^A-Za-z0-9])AI([^A-Za-z0-9]|$)/i.test(text);
  if (keyword === "요가" && /토요가무|토요가곡|토요가족/.test(text)) return false;
  if (keyword === "수영" && /수영구|수영동|수영로/.test(text)) return false;
  return text.toLocaleLowerCase("ko").includes(keyword.toLocaleLowerCase("ko"));
}
function isGeneral(text: string) { return text.replace(/\s/g, "").includes("일반체육활동"); }
function special(text: string): string | null {
  const plain = text.replace(/\s/g, "");
  if (/무더위쉼터|폭염쉼터|더위쉼터/.test(plain)) return "icon_heat_shelter";
  if (plain.includes("어르신체육활동사업")) return "icon_senior_activity";
  if (!isGeneral(text)) {
    if (matches("대강당", text)) return "icon_main_auditorium";
    if (matches("박물관", text)) return "icon_museum";
    const child = ["아동", "유아", "유소년", "어린이", "초등", "키즈"].some((v) => matches(v, text));
    const physical = ["체육", "신체", "운동", "스포츠", "체조", "줄넘기", "수영", "축구", "농구", "배드민턴", "태권도", "요가", "댄스", "놀이"].some((v) => matches(v, text));
    if (child && physical) return "icon_child_activity";
  }
  return null;
}
function workbook(text: string): string | null {
  const normalized = normalize(text);
  if (!normalized) return null;
  const first = special(normalized);
  if (first) return first;
  if (["공연/전시", "공연·전시", "문화/공연/전시", "문화·공연·전시"].includes(normalized.replace(/\s/g, ""))) return "icon_culture";
  for (const [icon, keywords] of RULES) if (keywords.some((keyword) => matches(keyword, normalized))) return icon;
  return null;
}
function authoritative(program: WebProgram): string | null {
  if (normalize(program.source).includes("공유누리")) return null;
  const field = compact(program.rawField);
  const category = compact(program.rawCategory);
  if (field.includes("전시미술") || category === "미술전시") return "icon_visual_arts";
  if (field.includes("전시관람") || field === "전시" || category === "전시") return "icon_exhibition";
  if (field.includes("행사축제") || field.startsWith("축제") || category.includes("행사축제")) return "icon_festival";
  if (field === "국악" || category === "국악") return "icon_traditional_music";
  if (field === "무용" || category === "무용") return "icon_dance";
  if (["클래식", "콘서트", "독주독창회", "음악콘서트"].includes(field)) return "icon_music";
  if (field === "연극" || category === "연극") return "icon_theater";
  if (["뮤지컬", "뮤지컬오페라", "오페라"].includes(field)) return "icon_musical";
  return null;
}

export function programIconName(program: WebProgram): string {
  const source = normalize(program.source);
  const maxClass = compact(program.maxClassName);
  const all = [program.name, program.facility, program.rawCategory, program.rawField, program.maxClassName, program.minClassName].filter(Boolean).join(" ");
  const first = special(all);
  if (first) return first;
  if (source.includes("공유누리") && maxClass.includes("문화공간")) return "icon_space_rental";
  const sourceIcon = authoritative(program);
  if (sourceIcon) return sourceIcon;
  const titleIcon = workbook(program.name);
  if (source.includes("공유누리") && maxClass.includes("체육시설")) {
    if (titleIcon && SPORTS.has(titleIcon)) return titleIcon;
    for (const value of [program.rawField, program.minClassName]) {
      const icon = workbook(value ?? "");
      if (icon && SPORTS.has(icon)) return icon;
    }
    return "icon_sports";
  }
  if (source.includes("공유누리") && maxClass.includes("교육강좌")) {
    return `${compact(program.rawField)}${compact(program.minClassName)}`.includes("건강체육프로그램") ? "icon_sports" : "icon_humanities";
  }
  if (titleIcon) return titleIcon;
  for (const value of [program.rawCategory, program.rawField, program.maxClassName, program.minClassName]) {
    if (["문화행사", "문화정보", "교육강좌", "체육시설", "문화공간", "공공서비스", "기타", "기타프로그램"].includes(compact(value))) continue;
    const icon = workbook(value ?? "");
    if (icon) return icon;
  }
  return workbook(program.category) ?? "icon_other";
}

export function dominantProgram(programs: WebProgram[], statusRank: (program: WebProgram) => number): WebProgram {
  const groups = new Map<string, WebProgram[]>();
  for (const program of programs) {
    const icon = programIconName(program);
    groups.set(icon, [...(groups.get(icon) ?? []), program]);
  }
  const icon = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]?.[0];
  return [...(groups.get(icon) ?? programs)].sort((a, b) => statusRank(a) - statusRank(b) || a.id.localeCompare(b.id))[0];
}
