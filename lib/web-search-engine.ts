import type { WebPlaceSuggestion, WebProgram } from "@/lib/web-program-data";

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

export type SearchCityScope = {
  displayName: string;
  regionPath: string;
  candidateAreaTerms: string[];
};

export type SearchResultCategory = {
  id: string;
  label: string;
  emoji: string;
  count: number;
};

export type OutOfAreaTitleSuggestion = {
  regionName: string;
  programName: string;
  suggestedQuery: string;
  programID: string;
};

type RankedTitleCandidate = { program: WebProgram; score: number };

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
const TOP_LEVEL_AREAS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];
const FALSE_ADMINISTRATIVE_WORDS = /^(?:시|전시|도시|교시|표시|실시)$|(?:동아리|요리|스토리|심리|물리|원리|권리|복리|마무리|소리)$/;
const PLACE_NOISE_WORDS = new Set(["근처", "주변", "인근", "부근", "일대", "가까운", "가까이", "지역", "장소", "쪽", "에서", "으로", "로", "까지"]);
const PLACE_SUFFIX_PATTERN = /(광장|공원|궁|성|역|시장|거리|일대|센터|복지관|도서관|수영장|체육관|운동장|미술관|박물관|공연장|문화회관|주민센터|구청|시청|대학|학교|산|천|공항|터미널)$/;

function unique(values: string[]) { return [...new Set(values.map((item) => item.trim()).filter(Boolean))]; }
function semanticIncludes(text: string, term: string) {
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  if (needle === "물놀이") return lower.replace(/(?:사물놀이|풍물놀이)/g, "").includes(needle);
  if (needle === "수영") return lower.replace(/수영(?:구|동|로)/g, "").includes(needle);
  if (needle === "요가") return lower.replace(/토요(?:가무|가곡|가족)/g, "").includes(needle);
  return lower.includes(needle);
}
function normalizedQuery(raw: string) {
  let result = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of REPLACEMENTS) result = result.replace(pattern, replacement);
  return result;
}

function compactKey(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko").replace(/[^가-힣a-z0-9]/g, "");
}

function titleTokens(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("ko")
    .split(/[^가-힣a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function bigramSimilarity(lhs: string, rhs: string) {
  if (lhs === rhs) return 1;
  if (lhs.length < 2 || rhs.length < 2) return 0;
  const counts = new Map<string, number>();
  for (let index = 0; index < lhs.length - 1; index += 1) {
    const key = lhs.slice(index, index + 2);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let overlap = 0;
  for (let index = 0; index < rhs.length - 1; index += 1) {
    const key = rhs.slice(index, index + 2);
    const count = counts.get(key) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(key, count - 1);
    }
  }
  return (2 * overlap) / (lhs.length + rhs.length - 2);
}

/** 제목을 조금 다르게 기억한 경우도 찾되 한두 글자 우연 일치는 제외한다. */
export function titleSearchMatchScore(query: string, title: string) {
  const queryKey = compactKey(query);
  const titleKey = compactKey(title);
  if (queryKey.length < 4 || titleKey.length < 2) return 0;
  if (queryKey === titleKey) return 1_000;
  if (titleKey.includes(queryKey)) return 950;
  if (queryKey.includes(titleKey) && titleKey.length >= 4) return 900;

  const tokens = titleTokens(query);
  if (!tokens.length) return 0;
  const matched = tokens.filter((token) => titleKey.includes(compactKey(token)));
  if (!matched.some((token) => compactKey(token).length >= 3)) return 0;
  const coverage = matched.length / tokens.length;
  const firstKey = compactKey(tokens[0]);
  const startsWithDistinctiveToken = firstKey.length >= 3 && titleKey.startsWith(firstKey);
  if (coverage < 0.5 || (!startsWithDistinctiveToken && coverage < 1)) return 0;
  return coverage * 60 + (startsWithDistinctiveToken ? 30 : 0)
    + bigramSimilarity(queryKey, titleKey) * 20;
}

function rankedTitleCandidates(query: string, programs: WebProgram[]): RankedTitleCandidate[] {
  return programs.map((program) => ({ program, score: titleSearchMatchScore(query, program.name) }))
    .filter((candidate) => candidate.score >= 55)
    .sort((lhs, rhs) => rhs.score - lhs.score || lhs.program.name.localeCompare(rhs.program.name, "ko"));
}

/** 행정지역 검색에서 엄격한 모든 단어 일치가 0건일 때 제목 유사 후보를 보완한다. */
export function fuzzyAdministrativeTitlePrograms(
  query: string,
  intent: SearchIntent,
  programs: WebProgram[],
  limit = 20,
) {
  if (!intent.areaTerms.length || intent.subjectTerms.length || !intent.generalTerms.length) return [];
  const ranked = rankedTitleCandidates(intent.generalTerms.join(" "), programs);
  const bestScore = ranked[0]?.score ?? 0;
  return ranked.filter((candidate) => candidate.score >= bestScore - 10)
    .slice(0, limit)
    .map((candidate) => candidate.program);
}

/** 행정지역+기억한 제목 검색은 도시 전역 검색이며 좌표 반경 검색으로 바꾸지 않는다. */
export function isAdministrativeTitleQuery(
  query: string,
  intent = parseSearchIntent(query),
) {
  return intent.areaTerms.length > 0
    && intent.subjectTerms.length === 0
    && intent.generalTerms.join("").length >= 4;
}

function programTopLevelRegion(program: WebProgram) {
  const document = `${program.region ?? ""} ${program.address ?? ""} ${program.area}`;
  return TOP_LEVEL_AREAS.find((area) => compactKey(document).includes(compactKey(area))) ?? "";
}

export function strongOutOfAreaTitleSuggestion(
  query: string,
  currentScope: SearchCityScope,
  programs: WebProgram[],
): OutOfAreaTitleSuggestion | null {
  const intent = parseSearchIntent(query);
  const queryKey = compactKey(query);
  if (intent.areaTerms.length || intent.subjectTerms.length || queryKey.length < 4) return null;
  const ranked = rankedTitleCandidates(query, programs);
  const outside = ranked.find(({ program }) => !programMatchesAreaTerms(program, currentScope.candidateAreaTerms));
  if (!outside) return null;
  const currentBest = ranked.find(({ program }) => programMatchesAreaTerms(program, currentScope.candidateAreaTerms));
  if (currentBest && currentBest.score >= outside.score - 8) return null;
  const regionName = programTopLevelRegion(outside.program);
  if (!regionName) return null;
  return {
    regionName,
    programName: outside.program.name,
    suggestedQuery: `${regionName} ${query.trim()}`,
    programID: outside.program.id,
  };
}

function canonicalTopLevel(value: string) {
  const aliases: Record<string, string> = {
    서울특별시: "서울", 서울시: "서울", 부산광역시: "부산", 부산시: "부산",
    대구광역시: "대구", 대구시: "대구", 인천광역시: "인천", 인천시: "인천",
    광주광역시: "광주", 광주시: "광주", 대전광역시: "대전", 대전시: "대전",
    울산광역시: "울산", 울산시: "울산", 세종특별자치시: "세종", 세종시: "세종",
    경기도: "경기", 강원도: "강원", 강원특별자치도: "강원", 충청북도: "충북",
    충청남도: "충남", 전라북도: "전북", 전북특별자치도: "전북", 전라남도: "전남",
    경상북도: "경북", 경상남도: "경남", 제주도: "제주", 제주특별자치도: "제주",
  };
  return aliases[value] ?? value;
}

function areaTokens(normalized: string) {
  const explicit = normalized.match(/[가-힣A-Za-z0-9]+(?:특별시|광역시|특별자치시|특별자치도|도|시|군|구|읍|면|동|리)/g) ?? [];
  const topLevel = normalized.split(/\s+/).filter((token) => TOP_LEVEL_AREAS.includes(canonicalTopLevel(token)));
  return unique([...topLevel, ...explicit].filter((area) => {
    if (FALSE_ADMINISTRATIVE_WORDS.test(area)) return false;
    if (/^수영(?:구|동)$/.test(area)) return /부산|지역|동네|근처|주변|에서/.test(normalized);
    return true;
  }));
}

export function parseSearchIntent(raw: string): SearchIntent {
  const normalized = normalizedQuery(raw);
  const subjectTerms: string[] = [];
  for (const [label, terms] of SUBJECT_GROUPS) if (terms.some((term) => normalized.toLowerCase().includes(term.toLowerCase()))) subjectTerms.push(label, ...terms);
  const areaTerms = areaTokens(normalized);
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
  const radiusChip = radiusKm === null ? null : explicitRadius
    ? radiusKm < 1 ? `${Math.round(radiusKm * 1_000)}m 이내` : `${radiusKm}km 이내`
    : "근처";
  const chips = [
    areaTerms[0], radiusChip,
    free === true ? "무료" : free === false ? "유료" : null,
    day === "weekend" ? "주말" : day === "weekday" ? "평일" : null,
    time === "morning" ? "오전" : time === "afternoon" ? "오후" : time === "evening" ? "저녁" : null,
    dateTarget === "today" ? "오늘" : dateTarget === "tomorrow" ? "내일" : null,
    audiences[0] === "senior" ? "어르신" : audiences[0] === "child" ? "아이" : audiences[0] === "family" ? "가족" : audiences[0] === "worker" ? "직장인" : null,
    status === "open" ? "접수중" : status === "soon" ? "접수예정" : status === "closing" ? "마감임박" : null,
    subjectTerms[0],
  ].filter((item): item is string => Boolean(item));
  return { original: raw, normalized, subjectTerms: unique(subjectTerms), areaTerms, generalTerms, audiences, free, day, time, status, dateTarget, radiusKm, chips: unique(chips) };
}

export function searchSuggestionQuery(query: string, intent = parseSearchIntent(query)) {
  if (intent.areaTerms.length) return intent.areaTerms.join(" ");
  if (intent.subjectTerms.length && intent.generalTerms.length) return intent.generalTerms.join(" ");
  return intent.subjectTerms.length ? "" : intent.normalized;
}

export function shouldRequestPlaceSuggestions(query: string, intent = parseSearchIntent(query)) {
  const candidate = searchSuggestionQuery(query, intent);
  if (candidate.length < 2 || FALSE_ADMINISTRATIVE_WORDS.test(candidate)) return false;
  return intent.areaTerms.length > 0
    || intent.subjectTerms.length === 0
    || (intent.subjectTerms.length > 0 && intent.generalTerms.length > 0)
    || PLACE_SUFFIX_PATTERN.test(candidate)
    || /근처|주변|인근|부근|일대/.test(query);
}

export function hasAmbiguousAdministrativeSuggestions(query: string, suggestions: WebPlaceSuggestion[]) {
  const queryKey = compactKey(searchSuggestionQuery(query) || query);
  const exactAdministrative = suggestions.filter((suggestion) => {
    if (suggestion.placeKind !== "administrative" || suggestion.confidence < 100) return false;
    const finalToken = suggestion.displayName.split(/\s+/).at(-1) ?? suggestion.displayName;
    return compactKey(finalToken) === queryKey || compactKey(suggestion.displayName) === queryKey;
  });
  return exactAdministrative.length > 1;
}

export function resolveSearchCityScope(intent: SearchIntent, currentRegion: string): SearchCityScope {
  const components = (intent.areaTerms.length ? intent.areaTerms : currentRegion.split(/\s+/))
    .map((value) => value.trim())
    .filter(Boolean);
  const rawTopLevel = components[0] ?? "서울";
  const topLevel = canonicalTopLevel(rawTopLevel);
  const metropolitan = new Set(["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종"]);
  if (metropolitan.has(topLevel)) {
    return { displayName: topLevel, regionPath: topLevel, candidateAreaTerms: [topLevel] };
  }
  const provinceIndex = TOP_LEVEL_AREAS.indexOf(topLevel);
  if (provinceIndex >= 8) {
    const locality = components.slice(1).map(canonicalTopLevel).find((value) => /시$|군$/.test(value))
      ?? components.slice(1).map((value) => value.replace(/(?:특별시|광역시|시|군)$/, "")).find(Boolean);
    if (locality) return { displayName: locality.replace(/(?:시|군)$/, ""), regionPath: `${topLevel} ${locality}`, candidateAreaTerms: [topLevel, locality] };
    return { displayName: topLevel, regionPath: topLevel, candidateAreaTerms: [topLevel] };
  }
  const fallback = canonicalTopLevel(currentRegion.split(/\s+/)[0] ?? "서울");
  return { displayName: fallback, regionPath: fallback, candidateAreaTerms: [fallback] };
}

export function preferredPlaceSuggestion(query: string, intent: SearchIntent, suggestions: WebPlaceSuggestion[]) {
  if (!suggestions.length || (intent.subjectTerms.length > 0 && !searchSuggestionQuery(query, intent))) return null;
  const candidateKey = compactKey(searchSuggestionQuery(query, intent) || query);
  return suggestions.find((suggestion) => {
    const finalToken = suggestion.displayName.split(/\s+/).at(-1) ?? suggestion.displayName;
    return suggestion.latitude !== null && suggestion.longitude !== null
      && suggestion.confidence >= 90
      && (compactKey(finalToken).includes(candidateKey) || compactKey(suggestion.displayName).includes(candidateKey));
  }) ?? suggestions.find((suggestion) => suggestion.latitude !== null && suggestion.longitude !== null && suggestion.confidence >= 75) ?? null;
}

export function searchAroundPlacePrograms(
  programs: WebProgram[],
  query: string,
  place: WebPlaceSuggestion,
  radiusKm: number,
) {
  const base = parseSearchIntent(query);
  const placeKey = compactKey(place.displayName);
  const intent: SearchIntent = {
    ...base,
    areaTerms: [],
    generalTerms: base.generalTerms.filter((term) => {
      const key = compactKey(term);
      return key && !placeKey.includes(key) && !PLACE_NOISE_WORDS.has(term);
    }),
    radiusKm,
    chips: unique([
      ...base.chips.filter((chip) => !base.areaTerms.includes(chip) && chip !== "근처" && !/(?:km|m) 이내$/.test(chip)),
      radiusKm < 1 ? `${Math.round(radiusKm * 1_000)}m 이내` : `${radiusKm}km 이내`,
    ]),
  };
  return {
    intent,
    results: searchPrograms(programs, intent, {
      latitude: place.latitude ?? 0,
      longitude: place.longitude ?? 0,
    }).slice(0, 300),
  };
}

const RESULT_CATEGORY_RULES: Array<[id: string, label: string, emoji: string, terms: RegExp]> = [
  ["education", "교육", "📚", /교육|학습|배움|강의|교실|학교|아카데미|문해|자격증|연수/],
  ["course", "강좌", "📝", /강좌|강의|수업|교실|과정|아카데미|클래스|배우기|교육/],
  ["performance", "공연", "🎭", /공연|연극|뮤지컬|콘서트|음악회|오페라|무대|상영|영화제|발표회|연주회/],
  ["sports", "체육", "🏃", /체육|운동|스포츠|수영|요가|필라테스|탁구|테니스|축구|농구|배드민턴|헬스|체조|스트레칭|러닝|달리기|걷기|댄스/],
  ["culture", "문화", "🏛️", /문화|전통|문학|영화|예술|미술|전시|공연|행사|축제/],
  ["art", "예술", "🎨", /예술|미술|그림|수채화|회화|공예|도예|서예|사진|음악|악기|피아노|기타|우쿨렐레|국악|무용/],
  ["exhibition", "전시", "🖼️", /전시|전람|박람회|기획전|특별전|미술관|박물관|갤러리/],
  ["experience", "체험", "🙌", /체험|만들기|워크숍|워크샵|탐방|견학|투어|놀이|캠프/],
  ["event", "행사·축제", "🎉", /행사|축제|페스티벌|기념식|캠페인|플리마켓|장터/],
  ["digital", "디지털", "📱", /디지털|컴퓨터|스마트폰|키오스크|코딩|인공지능|인터넷|미디어/],
  ["welfare", "복지", "🤝", /복지|취약계층|돌봄|상담|재활|치매|마음건강|봉사/],
  ["humanities", "인문·독서", "📖", /인문|독서|책읽기|책 읽기|도서|글쓰기|논술|역사|철학|문학/],
  ["cooking", "요리", "🍳", /요리|쿠킹|제과|제빵|바리스타|음식|반찬/],
  ["facility", "시설 이용", "🏢", /시설 이용|시설이용|대관|공간 예약|이용시간|자유 이용|자유이용/],
];

export function searchResultCategoryIDs(program: WebProgram) {
  const text = `${program.name} ${program.summary} ${program.maxClassName ?? ""} ${program.minClassName ?? ""}`.toLocaleLowerCase("ko");
  const ids = RESULT_CATEGORY_RULES.filter(([, , , pattern]) => pattern.test(text)).map(([id]) => id);
  return ids.length ? ids : ["other"];
}

export function searchResultCategories(programs: WebProgram[]): SearchResultCategory[] {
  const counts = new Map<string, number>();
  programs.forEach((program) => searchResultCategoryIDs(program).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));
  const ordered = RESULT_CATEGORY_RULES.map(([id, label, emoji]) => ({ id, label, emoji, count: counts.get(id) ?? 0 })).filter((item) => item.count > 0);
  if (counts.get("other")) ordered.push({ id: "other", label: "기타", emoji: "⭐️", count: counts.get("other")! });
  return ordered;
}

export function haversineMeters(a: Coordinate, b: Coordinate) {
  const radius = 6_371_000; const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function programMatchesAreaTerms(program: WebProgram, areaTerms: string[]) {
  if (!areaTerms.length) return true;
  const locationTokens = `${program.address ?? ""} ${program.area}`
    .split(/[\s,()·]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  return areaTerms.every((term) => {
    const canonicalTerm = canonicalTopLevel(term);
    if (TOP_LEVEL_AREAS.includes(canonicalTerm)) {
      return locationTokens.some((token) => canonicalTopLevel(token) === canonicalTerm);
    }
    const normalizedTerm = term.toLocaleLowerCase("ko");
    return locationTokens.some((token) => {
      const normalizedToken = token.toLocaleLowerCase("ko");
      return normalizedToken === normalizedTerm || normalizedToken.startsWith(normalizedTerm);
    });
  });
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
    const areaMatch = programMatchesAreaTerms(program, intent.areaTerms);
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

export function relaxedSuggestions(intent: SearchIntent): Array<{ label: string; message: string; appliedNotice: string; intent: SearchIntent }> {
  const results: Array<{ label: string; message: string; appliedNotice: string; intent: SearchIntent }> = [];
  if (intent.dateTarget) results.push({ label: "날짜 조건 빼고 보기", message: "날짜만 빼면 신청 가능한 프로그램이 있는지 다시 확인할 수 있어요.", appliedNotice: "날짜 조건을 빼고 다시 찾았어요.", intent: { ...intent, dateTarget: null, chips: intent.chips.filter((chip) => chip !== "오늘" && chip !== "내일") } });
  if (intent.radiusKm) results.push({ label: `${Math.min(100, intent.radiusKm * 2)}km까지 넓혀보기`, message: "현재 위치에서 검색 반경을 넓히면 더 많은 프로그램을 확인할 수 있어요.", appliedNotice: `검색 반경을 ${Math.min(100, intent.radiusKm * 2)}km까지 넓혔어요.`, intent: { ...intent, radiusKm: Math.min(100, intent.radiusKm * 2), chips: intent.chips.filter((chip) => !chip.endsWith("km 이내")).concat(`${Math.min(100, intent.radiusKm * 2)}km 이내`) } });
  if (intent.day) results.push({ label: "요일 조건 넓혀보기", message: "평일·주말 조건을 빼면 다른 요일의 프로그램도 함께 볼 수 있어요.", appliedNotice: "요일 조건을 넓혀 다시 찾았어요.", intent: { ...intent, day: null, chips: intent.chips.filter((chip) => chip !== "주말" && chip !== "평일") } });
  if (intent.time) results.push({ label: "시간대 넓혀보기", message: "시간대를 넓히면 오전·오후·저녁 프로그램을 함께 확인할 수 있어요.", appliedNotice: "시간대 조건을 넓혀 다시 찾았어요.", intent: { ...intent, time: null, chips: intent.chips.filter((chip) => !["오전", "오후", "저녁"].includes(chip)) } });
  if (intent.free !== null) results.push({ label: "비용 조건 넓혀보기", message: "비용 조건을 빼면 무료와 유료 프로그램을 함께 비교할 수 있어요.", appliedNotice: "비용 조건을 넓혀 다시 찾았어요.", intent: { ...intent, free: null, chips: intent.chips.filter((chip) => chip !== "무료" && chip !== "유료") } });
  if (intent.audiences.length) results.push({ label: "대상 조건 넓혀보기", message: "대상 조건을 넓히면 가족과 일반 대상 프로그램도 함께 볼 수 있어요.", appliedNotice: "대상 조건을 넓혀 다시 찾았어요.", intent: { ...intent, audiences: [], chips: intent.chips.filter((chip) => !["어르신", "아이", "가족", "직장인"].includes(chip)) } });
  if (intent.status) results.push({ label: "접수 상태 넓혀보기", message: "접수 상태를 넓히면 곧 시작하거나 마감이 임박한 프로그램도 볼 수 있어요.", appliedNotice: "접수 상태를 넓혀 다시 찾았어요.", intent: { ...intent, status: null, chips: intent.chips.filter((chip) => !["접수중", "접수예정", "마감임박"].includes(chip)) } });
  return results.slice(0, 3);
}
