import type { WebProgram } from "@/lib/web-program-data";

export type SearchIntent = {
  original: string;
  normalized: string;
  subjectTerms: string[];
  areaTerms: string[];
  generalTerms: string[];
  audiences: Array<"senior" | "child" | "family" | "worker">;
  free: boolean | null;
  day: "weekday" | "weekend" | null;
  time: "morning" | "afternoon" | "evening" | null;
  status: "open" | "soon" | "closing" | null;
  dateTarget: "today" | "tomorrow" | null;
  radiusKm: number | null;
  chips: string[];
};

type Coordinate = { latitude: number; longitude: number };

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/공짜|돈\s*안\s*드는|무료로/g, "무료"], [/스맛폰|스마트 폰/g, "스마트폰"],
  [/키오스ㅋ|키오스크기/g, "키오스크"], [/베드민턴|배드민톤/g, "배드민턴"],
  [/필라테쓰/g, "필라테스"], [/아쿠아로빅/g, "아쿠아"], [/프로그렘|프로그램므/g, "프로그램"],
];

const SUBJECT_GROUPS: Array<[string, string[]]> = [
  ["수영", ["수영", "아쿠아", "물놀이"]], ["요가", ["요가"]], ["필라테스", ["필라테스"]],
  ["배드민턴", ["배드민턴"]], ["탁구", ["탁구"]], ["테니스", ["테니스", "정구"]],
  ["축구", ["축구", "풋살"]], ["농구", ["농구"]], ["골프", ["골프", "게이트볼"]],
  ["운동", ["운동", "체육", "헬스", "체조", "피트니스"]],
  ["미술", ["미술", "그림", "드로잉", "수채화", "회화"]], ["공예", ["공예", "만들기", "도예", "목공"]],
  ["음악", ["음악", "노래", "합창", "악기", "피아노"]], ["국악", ["국악", "판소리", "풍물"]],
  ["공연", ["공연", "연극", "뮤지컬", "콘서트"]], ["전시", ["전시", "미술관", "갤러리"]],
  ["축제", ["축제", "행사", "페스티벌"]], ["영화", ["영화", "상영", "시네마"]],
  ["컴퓨터", ["컴퓨터", "디지털", "코딩", "스마트폰", "키오스크", "AI", "인공지능"]],
  ["외국어", ["영어", "중국어", "일본어", "외국어", "한국어"]],
  ["요리", ["요리", "베이킹", "제과", "제빵", "바리스타"]],
  ["인문", ["인문", "역사", "철학", "독서", "글쓰기", "문학"]],
  ["복지", ["복지", "상담", "치매", "건강"]], ["대관", ["대관", "공간대여", "회의실", "강당"]],
];

const STOP_WORDS = new Set(["가까운", "근처", "주변", "우리", "동네", "프로그램", "강좌", "교실", "수업", "클래스", "찾아줘", "찾기", "추천", "이번", "갈", "들을", "할", "있는", "가능한", "아이랑", "어르신", "시니어", "부모님", "오늘", "내일", "오픈런", "시작하는", "시작", "접수"]);

function unique(values: string[]) { return [...new Set(values.map((item) => item.trim()).filter(Boolean))]; }
function semanticIncludes(text: string, term: string) {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  if (needle === "물놀이" && lower.includes("사물놀이")) return false;
  if (needle === "수영" && /수영구|수영동|수영로/.test(text)) return false;
  if (needle === "요가" && /토요가무|토요가곡|토요가족/.test(text)) return false;
  return lower.includes(needle);
}
function normalizedQuery(raw: string) {
  let result = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of REPLACEMENTS) result = result.replace(pattern, replacement);
  return result;
}

export function parseSearchIntent(raw: string): SearchIntent {
  const normalized = normalizedQuery(raw);
  const subjectTerms: string[] = [];
  for (const [label, terms] of SUBJECT_GROUPS) if (terms.some((term) => normalized.toLowerCase().includes(term.toLowerCase()))) subjectTerms.push(label, ...terms);
  const areaTerms = unique((normalized.match(/[가-힣A-Za-z0-9]+(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구|읍|면|동|리)/g) ?? []).filter((area) => {
    if (/^수영(?:구|동)$/.test(area)) return /부산|지역|동네|근처|주변|에서/.test(normalized);
    return true;
  }));
  const audiences: SearchIntent["audiences"] = [];
  if (/시니어|어르신|노인|부모님|65세|실버/.test(normalized)) audiences.push("senior");
  if (/아이|아동|어린이|유아|초등|청소년|키즈/.test(normalized)) audiences.push("child");
  if (/가족|아이랑|부모와/.test(normalized)) audiences.push("family");
  if (/직장인|퇴근|점심시간/.test(normalized)) audiences.push("worker");
  const free = /무료|공짜/.test(normalized) ? true : /유료|돈을?\s*내/.test(normalized) ? false : null;
  const day = /주말|토요일|일요일|토·일/.test(normalized) ? "weekend" : /평일|월요일|화요일|수요일|목요일|금요일/.test(normalized) ? "weekday" : null;
  const time = /오전|아침/.test(normalized) ? "morning" : /오후/.test(normalized) ? "afternoon" : /저녁|야간|퇴근/.test(normalized) ? "evening" : null;
  const status = /마감임박|곧\s*마감/.test(normalized) ? "closing" : /접수예정|곧\s*시작|오픈런|접수\s*시작/.test(normalized) ? "soon" : /접수중|신청가능|지금\s*신청/.test(normalized) ? "open" : null;
  const dateTarget = /내일/.test(normalized) ? "tomorrow" : /오늘/.test(normalized) ? "today" : null;
  const explicitRadius = normalized.match(/(\d+(?:\.\d+)?)\s*(km|킬로|m|미터)/i);
  let radiusKm: number | null = null;
  if (explicitRadius) radiusKm = Math.min(100, Math.max(0.5, Number(explicitRadius[1]) * (/m|미터/i.test(explicitRadius[2]) && !/km/i.test(explicitRadius[2]) ? 0.001 : 1)));
  else if (/가까운|근처|주변|우리\s*동네/.test(normalized)) radiusKm = 5;
  const known = unique([...subjectTerms, ...areaTerms]);
  const generalTerms = unique(normalized.split(/\s+/).filter((word) => word.length >= 2 && !STOP_WORDS.has(word) && !known.some((term) => term.includes(word) || word.includes(term)) && !/무료|유료|주말|평일|오전|오후|저녁|접수|신청/.test(word)));
  const fallback = unique([...subjectTerms, ...areaTerms, ...generalTerms]);
  if (!fallback.length) generalTerms.push(status ? "접수" : normalized);
  const chips = [
    subjectTerms[0], areaTerms[0], audiences[0] === "senior" ? "어르신" : audiences[0] === "child" ? "아이" : audiences[0] === "family" ? "가족" : audiences[0] === "worker" ? "직장인" : null,
    free === true ? "무료" : free === false ? "유료" : null, day === "weekend" ? "주말" : day === "weekday" ? "평일" : null,
    time === "morning" ? "오전" : time === "afternoon" ? "오후" : time === "evening" ? "저녁" : null,
    status === "open" ? "접수중" : status === "soon" ? "접수예정" : status === "closing" ? "마감임박" : null,
    dateTarget === "today" ? "오늘" : dateTarget === "tomorrow" ? "내일" : null,
    radiusKm ? `${radiusKm}km 이내` : null,
  ].filter((item): item is string => Boolean(item));
  return { original: raw, normalized, subjectTerms: unique(subjectTerms), areaTerms, generalTerms, audiences, free, day, time, status, dateTarget, radiusKm, chips: unique(chips) };
}

export function haversineMeters(a: Coordinate, b: Coordinate) {
  const radius = 6_371_000; const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function scheduleMatches(program: WebProgram, intent: SearchIntent) {
  const text = `${program.scheduleText ?? ""} ${program.periodText ?? ""}`;
  if (intent.day === "weekend" && !/토|일|주말/.test(text)) return false;
  if (intent.day === "weekday" && !/월|화|수|목|금|평일/.test(text)) return false;
  if (intent.time === "morning" && !/오전|AM|0[6-9]:|1[01]:/i.test(text)) return false;
  if (intent.time === "afternoon" && !/오후|PM|1[2-7]:/i.test(text)) return false;
  if (intent.time === "evening" && !/저녁|야간|1[8-9]:|2[0-3]:/i.test(text)) return false;
  return true;
}
function statusMatches(program: WebProgram, intent: SearchIntent) {
  if (!intent.status) return true;
  if (intent.status === "closing") return /마감임박/.test(program.status);
  if (intent.status === "soon") return /예정|곧/.test(program.status);
  return /접수중|상시|진행중|가능|안내중/.test(program.status);
}
function dateMatches(program: WebProgram, intent: SearchIntent) {
  if (!intent.dateTarget) return true;
  const target = new Date();
  if (intent.dateTarget === "tomorrow") target.setDate(target.getDate() + 1);
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
  const start = program.receiptStart ? new Date(program.receiptStart) : null;
  if (start && Number.isFinite(start.getTime())) {
    const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    if (startKey === key) return true;
  }
  return `${program.scheduleText ?? ""} ${program.periodText ?? ""}`.includes(intent.dateTarget === "today" ? "오늘" : "내일");
}
function audienceMatches(program: WebProgram, intent: SearchIntent) {
  if (!intent.audiences.length) return true;
  const text = `${program.audiences.join(" ")} ${program.requirement ?? ""} ${program.name}`;
  return intent.audiences.every((audience) => audience === "senior" ? /시니어|어르신|노인|65세|실버|성인/.test(text) : audience === "child" ? /아이|아동|어린이|유아|초등|청소년|키즈|가족/.test(text) : audience === "family" ? /가족|부모|아이|아동|어린이/.test(text) : /직장인|성인|일반/.test(text));
}

export function searchPrograms(programs: WebProgram[], intent: SearchIntent, origin: Coordinate) {
  const subjectNeedles = unique(intent.subjectTerms);
  return programs.flatMap((program) => {
    const subject = `${program.name} ${program.category} ${program.rawCategory} ${program.rawField} ${program.field}`.toLowerCase();
    const area = `${program.address ?? ""} ${program.area} ${program.facility}`.toLowerCase();
    const general = `${subject} ${area} ${program.summary} ${program.status} ${program.scheduleText ?? ""} ${program.periodText ?? ""}`.toLowerCase();
    const subjectMatch = !subjectNeedles.length || subjectNeedles.some((term) => semanticIncludes(subject, term));
    const areaMatch = intent.areaTerms.every((term) => area.includes(term.toLowerCase()));
    const generalMatch = intent.generalTerms.every((term) => general.includes(term.toLowerCase()));
    const distance = haversineMeters(origin, program);
    if (!subjectMatch || !areaMatch || !generalMatch || !audienceMatches(program, intent) || !scheduleMatches(program, intent) || !statusMatches(program, intent) || !dateMatches(program, intent)) return [];
    if (intent.free !== null && program.isFree !== intent.free) return [];
    if (intent.radiusKm && distance > intent.radiusKm * 1_000) return [];
    let score = 0;
    for (const term of unique([...subjectNeedles, ...intent.generalTerms])) {
      const needle = term.toLowerCase();
      if (program.name.toLowerCase().includes(needle)) score += 10;
      if (program.facility.toLowerCase().includes(needle)) score += 7;
      if (general.includes(needle)) score += 3;
    }
    if (/접수중|상시|진행중|가능/.test(program.status)) score += 3;
    if (program.isFree) score += 1;
    if (intent.radiusKm) score += Math.max(0, 5 - distance / Math.max(1, intent.radiusKm * 200));
    return [{ program, score, distance }];
  }).sort((a, b) => b.score - a.score || a.distance - b.distance || a.program.id.localeCompare(b.program.id));
}

export function relaxedSuggestions(intent: SearchIntent): Array<{ label: string; intent: SearchIntent }> {
  const results: Array<{ label: string; intent: SearchIntent }> = [];
  if (intent.dateTarget) results.push({ label: "날짜 조건 빼기", intent: { ...intent, dateTarget: null, chips: intent.chips.filter((chip) => chip !== "오늘" && chip !== "내일") } });
  if (intent.radiusKm) results.push({ label: `${Math.min(100, intent.radiusKm * 2)}km까지 넓히기`, intent: { ...intent, radiusKm: Math.min(100, intent.radiusKm * 2), chips: intent.chips.filter((chip) => !chip.endsWith("km 이내")).concat(`${Math.min(100, intent.radiusKm * 2)}km 이내`) } });
  if (intent.day) results.push({ label: "요일 조건 빼기", intent: { ...intent, day: null, chips: intent.chips.filter((chip) => chip !== "주말" && chip !== "평일") } });
  if (intent.time) results.push({ label: "시간대 넓히기", intent: { ...intent, time: null, chips: intent.chips.filter((chip) => !["오전", "오후", "저녁"].includes(chip)) } });
  if (intent.free !== null) results.push({ label: "비용 조건 빼기", intent: { ...intent, free: null, chips: intent.chips.filter((chip) => chip !== "무료" && chip !== "유료") } });
  if (intent.audiences.length) results.push({ label: "대상 조건 넓히기", intent: { ...intent, audiences: [], chips: intent.chips.filter((chip) => !["어르신", "아이", "가족", "직장인"].includes(chip)) } });
  if (intent.status) results.push({ label: "접수 상태 넓히기", intent: { ...intent, status: null, chips: intent.chips.filter((chip) => !["접수중", "접수예정", "마감임박"].includes(chip)) } });
  return results.slice(0, 3);
}
