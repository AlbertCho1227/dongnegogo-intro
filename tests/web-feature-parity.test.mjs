import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dominantProgram, programIconName } from "../lib/web-icon-mapper.ts";
import { parseSearchIntent, searchPrograms } from "../lib/web-search-engine.ts";

const webMapSource = readFileSync(new URL("../app/web/web-map-app.tsx", import.meta.url), "utf8");
const webMapStyle = readFileSync(new URL("../app/web/web-map.css", import.meta.url), "utf8");
const webMapLinksSource = readFileSync(new URL("../lib/web-map-links.ts", import.meta.url), "utf8");
const webSearchAssistantRoute = readFileSync(new URL("../app/api/web-search-assistant/route.ts", import.meta.url), "utf8");
const webRouteSource = readFileSync(new URL("../lib/web-route-data.ts", import.meta.url), "utf8");
const webUserSource = readFileSync(new URL("../lib/web-user-data.ts", import.meta.url), "utf8");
const webProgramFiltersSource = readFileSync(new URL("../lib/web-program-filters.ts", import.meta.url), "utf8");

function program(overrides = {}) {
  return {
    id: "sample", name: "일반 프로그램", category: "기타", field: "", facility: "동네센터",
    room: null, address: "서울특별시 성북구 정릉동", area: "성북구", latitude: 37.6027, longitude: 127.0128,
    isFree: true, feeText: "무료", status: "접수중", audiences: ["성인"], scheduleText: null,
    periodText: null, receiptStart: null, receiptEnd: null, applyUrl: null, phone: null, summary: "",
    requirement: null, preparation: null, imageUrl: null, source: "서울시 공공서비스예약",
    rawCategory: "기타", rawField: "", maxClassName: null, minClassName: null, isSeniorRecommended: false,
    ...overrides,
  };
}

test("iOS 자연어 검색의 비용·거리·종목 조건을 AND로 해석한다", () => {
  const intent = parseSearchIntent("가까운 무료 수영 강좌");
  assert.equal(intent.free, true);
  assert.equal(intent.radiusKm, 5);
  assert.ok(intent.subjectTerms.includes("수영"));
  assert.deepEqual(intent.chips, ["근처", "무료", "수영"]);
});

test("오픈런 문장에서 내일 접수 시작 조건을 별도 축으로 해석한다", () => {
  const intent = parseSearchIntent("내일 오픈런 접수 시작하는 강좌");
  assert.equal(intent.status, "soon");
  assert.equal(intent.dateTarget, "tomorrow");
  assert.ok(intent.generalTerms.includes("접수"));
  assert.ok(intent.chips.includes("내일"));
});

test("수영·요가 지명 오탐과 사물놀이의 물놀이 오탐을 제외한다", () => {
  const intent = parseSearchIntent("서울 무료 수영");
  const matches = searchPrograms([
    program({ id: "swim", name: "성인 수영 교실" }),
    program({ id: "samul", name: "사물놀이동아리" }),
    program({ id: "pungmul", name: "우리동네 풍물놀이" }),
    program({ id: "district", name: "수영구 주민 강좌", address: "부산광역시 수영구" }),
  ], intent, { latitude: 37.6027, longitude: 127.0128 });
  assert.deepEqual(matches.map((item) => item.program.id), ["swim"]);
});

test("iOS 마커 우선순위와 동일 좌표 대표 아이콘을 재현한다", () => {
  assert.equal(programIconName(program({ name: "어르신체육활동사업" })), "icon_senior_activity");
  assert.equal(programIconName(program({ name: "돈암 주민센터 대강당" })), "icon_main_auditorium");
  assert.equal(programIconName(program({ name: "공유 전시실", source: "공유누리", maxClassName: "문화·공간" })), "icon_space_rental");
  const representative = dominantProgram([
    program({ id: "yoga", name: "저녁 요가", status: "접수중" }),
    program({ id: "swim-b", name: "아쿠아 교실", status: "접수예정" }),
    program({ id: "swim-a", name: "성인 수영", status: "접수중" }),
  ], (item) => item.status === "접수중" ? 0 : 1);
  assert.equal(representative.id, "swim-a");
});

test("조건 수영은 사물놀이를 제외하고 실제 물놀이만 포함한다", () => {
  const samul = program({ id: "samul-filter", name: "신나는 사물놀이 한마당", rawCategory: "국악", rawField: "국악" });
  const pungmul = program({ id: "pungmul-filter", name: "신명나는 풍물놀이", rawCategory: "국악", rawField: "국악" });
  const waterPlay = program({ id: "water-filter", name: "여름 물놀이 안전교실", rawCategory: "체육" });
  assert.equal(programIconName(samul), "icon_traditional_music");
  assert.notEqual(programIconName(samul), "icon_swimming");
  assert.equal(programIconName(pungmul), "icon_traditional_music");
  assert.notEqual(programIconName(pungmul), "icon_swimming");
  assert.equal(programIconName(waterPlay), "icon_swimming");
  assert.match(webProgramFiltersSource, /programIconName\(program\)/);
});

test("iOS 찾기의 입력·도시·장소·대안 상태를 웹에 유지한다", () => {
  for (const copy of [
    "지역으로 지도 이동",
    "같은 이름의 지역이 여러 곳이에요",
    "원하시는 장소를 이해했어요",
    "버들이가 꼼꼼히 살펴보는 중",
    "검색 반경 조절",
    "버들이의 다른 제안",
    "다른 지역 검색을 원하시면",
    "프로그램 분류",
    "관련도 순",
  ]) assert.ok(webMapSource.includes(copy), `${copy} 검색 상태가 빠졌습니다.`);
  assert.match(webMapSource, /SEARCH_PLACE_RADIUS_OPTIONS = \[0\.3, 0\.5, 1, 3, 5, 10, 20\]/);
  assert.match(webMapSource, /searchSuggestionsLoading/);
  assert.match(webMapSource, /hasAmbiguousAdministrativeSuggestions/);
  assert.match(webMapSource, /preferredPlaceSuggestion/);
  assert.match(webMapSource, /searchAroundPlacePrograms/);
  assert.match(webSearchAssistantRoute, /fetchWebPlaceSuggestions/);
  assert.match(webSearchAssistantRoute, /fetchWebProgramsNear/);
  assert.match(webMapStyle, /\.dg-search-place-suggestions/);
  assert.match(webMapStyle, /\.dg-search-assistant-card/);
  assert.match(webMapStyle, /\.dg-search-radius-card/);
  assert.match(webMapStyle, /\.dg-search-filter-card/);
});

test("iOS 지도 핵심 반응 UI를 웹 회귀 경계에 포함한다", () => {
  for (const copy of [
    "같은 장소 프로그램",
    "누구를 위한 프로그램인가요?",
    "어떤 종목을 찾으세요?",
    "한 번에 한 종목만 선택할 수 있어요",
    "선택한 조건으로",
    "무더위쉼터",
    "목적지 주변 가게 보기",
    "오픈런 알림",
    "오늘부터 3일 전까지 열어본 프로그램이에요",
    "시설 거리뷰 보기",
    "도보 경로 계산 중",
    "아래 지도 영역을 선택하면 메인 지도에서",
    "현재 위치 사용하기",
    "대중교통으로 가는 길",
    "가족 정보 저장",
  ]) assert.ok(webMapSource.includes(copy), `${copy} UI가 빠졌습니다.`);
  assert.match(webMapSource, /aria-label="이전 달"/);
  assert.match(webMapSource, /aria-label="다음 달"/);
  assert.match(webMapSource, /\[100, 300, 500, 1000\]/);
  assert.match(webMapSource, /function NearbyRadiusSelector/);
  assert.match(webMapSource, /type="range"/);
  assert.match(webMapSource, /목적지에서 반경/);
  assert.match(webMapSource, /\[1000, 500, 300, 100\]\.filter\(\(value\) => value <= nearbyRadius\)/);
  assert.match(webMapSource, /nearbyMarkerElement/);
  assert.match(webMapStyle, /@keyframes dg-nearby-marker-pulse/);
  assert.match(webMapStyle, /\.dg-nearby-map-marker\.selected[^}]*border:\s*3px solid var\(--dg-green\)/);
  assert.match(webMapStyle, /\.dg-nearby-radius-control input::\-webkit-slider-thumb/);
  assert.match(webMapSource, /program\.facility\.split\(">"\)\[0\]/);
  assert.match(webMapSource, /map\.naver\.com\/p\/search\/\$\{encodeURIComponent\(query\)\}\?c=\$\{program\.longitude\},\$\{program\.latitude\}/);
  assert.match(webMapSource, /map\.kakao\.com\/link\/map\/\$\{encodeURIComponent\(destination\)\},\$\{program\.latitude\},\$\{program\.longitude\}/);
  assert.match(webMapLinksSource, /map\.kakao\.com\/link\/map/);
  assert.match(webMapSource, /nearbyCategoryDisplayName/);
  assert.match(webMapSource, /도보 약 \{walkMinutes\}분/);
  assert.match(webMapSource, /주변 주차 가능/);
  assert.match(webMapSource, /동네고고 지도에서 \$\{displayName\} 마커 강조/);
  assert.match(webMapSource, /네이버 지도에서 \$\{displayName\} 검색/);
  assert.match(webMapSource, /카카오 지도에서 \$\{displayName\} 검색/);
  assert.match(webMapStyle, /\.dg-nearby-map-actions > \* \{[^}]*height:\s*30px;[^}]*padding:\s*0 7px/);
  assert.match(webMapStyle, /\.dg-web-app \.dg-nearby-map-actions > a \{[^}]*font-size:\s*9px/);
  assert.match(webMapStyle, /\.dg-nearby-brand\.naver \{ background-image: url\('\/brand\/map-icons\/naver-map-ios\.jpg'\); \}/);
  assert.match(webMapStyle, /\.dg-nearby-brand\.kakao \{ background-image: url\('\/brand\/map-icons\/kakao-map-ios\.jpg'\); \}/);
  assert.doesNotMatch(webMapStyle, /\.dg-nearby-map-actions[^}]*transform:\s*scale/);
  assert.match(webMapStyle, /\.dg-calendar-grid/);
  assert.match(webMapStyle, /\.dg-route-endpoint/);
  assert.match(webMapSource, /routeEndpointElement\("origin"\)/);
  assert.match(webMapSource, /routeEndpointElement\("destination"\)/);
  assert.match(webMapSource, /className\.includes\("dg-route-endpoint"\) \? 28 : 20/);
  assert.match(webMapStyle, /\.dg-route-marker-visual\.origin \.dg-route-marker-core/);
  assert.match(webMapStyle, /\.dg-route-marker-visual\.destination \.dg-route-marker-core/);
  assert.match(webMapStyle, /\.dg-route-marker-visual\.origin \.dg-route-marker-core \{[^}]*border:\s*1\.8px solid rgba\(8,133,64,\.95\);[^}]*background:\s*linear-gradient\(145deg,#59d157,#0d9b4c\)/);
  assert.doesNotMatch(webMapStyle, /\.dg-route-origin\.fallback \.dg-route-marker-core/);
  assert.doesNotMatch(webMapStyle, /\.dg-route-preview-pin\.fallback \.dg-route-marker-core[^}]*grayscale/);
  assert.match(webMapStyle, /@keyframes dg-route-marker-ripple/);
  assert.match(webMapStyle, /\.dg-nearby-map-marker/);
  assert.match(webMapSource, /function KakaoRoutePreview/);
  assert.match(webMapSource, /function RouteJourneyDetails/);
  assert.match(webMapSource, /PersonStanding/);
  assert.match(webMapSource, /TramFront/);
  assert.match(webMapSource, /CarFront/);
  assert.match(webMapSource, /role="승차"/);
  assert.match(webMapSource, /role="하차"/);
  assert.match(webMapSource, /교통정보 · 카카오맵 제공/);
  assert.match(webMapSource, /routePanelActive\s*&&\s*routePanelMode\s*===\s*"route"/);
  assert.match(webMapSource, /type RoutePanelSnap = "hidden" \| "collapsed" \| "expanded"/);
  assert.match(webMapSource, /collapsed:\s*mode === "route" \? 230 : hasNearbySelection \? 368 : 350/);
  assert.match(webMapSource, /routePanelSnap === "expanded" && delta > 45/);
  assert.match(webMapSource, /routePanelSnap === "collapsed" && delta > 55/);
  assert.match(webMapSource, /도착지 주변 둘러보기/);
  assert.match(webMapStyle, /\.dg-side-panel\.dg-main-route-panel-expanded/);
  assert.match(webMapStyle, /--dg-main-route-panel-height:\s*230px/);
  assert.match(webMapStyle, /dg-main-route-panel-collapsed\.dg-main-route-panel-mode-nearby[^}]*350px/);
  assert.match(webMapStyle, /\.dg-route-preview/);
  assert.match(webMapStyle, /\.dg-journey-card/);
  assert.match(webMapStyle, /\.dg-map-link-card/);
  assert.match(webMapStyle, /\.dg-route-detail-sheet\s*\{[^}]*border-radius:\s*30px 30px 0 0/);
  assert.match(webMapStyle, /\.dg-route-detail-sheet\s*\{[^}]*left:\s*8px;[^}]*right:\s*8px/);
  assert.match(webMapStyle, /\.dg-route-detail-sheet \.dg-detail-footer\s*\{[^}]*left:\s*8px;[^}]*width:\s*calc\(100% - 16px\)/);
  assert.match(webMapStyle, /\.dg-place-sheet\s*\{[^}]*left:\s*8px;[^}]*right:\s*8px;[^}]*bottom:\s*74px/);
  assert.match(webMapSource, /dg-ios-heart-icon/);
  assert.match(webMapSource, /<Share className="dg-ios-share-icon" aria-hidden="true" strokeWidth=\{2\.4\} \/>/);
  assert.match(webMapStyle, /\.dg-ios-share-icon \{[^}]*width:\s*18px;[^}]*height:\s*20px;[^}]*color:\s*#20241f;[^}]*stroke:\s*currentColor;/);
  assert.doesNotMatch(webMapStyle, /\.dg-ios-share-icon::(?:before|after)/);
  assert.match(webMapSource, /dg-ios-map-icon/);
  assert.match(webMapSource, /mobileMapPanel && !placeSheet && !sidePanelOverlay/);
  assert.match(webMapSource, /<em>내리면 패널 숨기기<\/em>/);
  assert.match(webMapSource, /addListener\(map, "dragstart"/);
  assert.match(webMapSource, /setFilterFitAppliedSignature\(null\)/);
  assert.match(webMapSource, /locationRequestState === "checking"/);
  assert.match(webMapSource, /locationError\.code === 1/);
  assert.match(webMapSource, /timeout:\s*20_000/);
  assert.ok(webMapSource.indexOf('className="dg-location-guide"') < webMapSource.indexOf('className="dg-route-map-guide"'), "현재 위치 안내가 지도 선택 안내보다 먼저 표시되어야 합니다.");
  assert.doesNotMatch(webMapStyle, /\.dg-map-tools button:nth-child\(2\).*display:\s*none/);
});

test("상세 종목은 하나만 선택하고 대상 조건은 다중 선택한다", () => {
  assert.match(webProgramFiltersSource, /programIconName\(program\)/);
  assert.match(webProgramFiltersSource, /detailLabels\.some/);
  assert.match(webProgramFiltersSource, /personaLabels\.some/);
  assert.match(webProgramFiltersSource, /label: "컴퓨터·스마트폰·AI"/);
  assert.match(webProgramFiltersSource, /label: "1인가구"/);
  assert.match(webProgramFiltersSource, /toggleSingleWebDetailFilter[\s\S]*?current\.includes\(label\) \? \[\] : \[label\]/);
  assert.match(webMapSource, /setSubjectFilters\(\(current\) => toggleSingleWebDetailFilter\(current, label\)\)/);
  assert.match(webMapSource, /setPersonaFilters\(personaFilters\.includes\(label\)/);
  assert.match(webMapSource, /한 번에 한 종목만 선택할 수 있어요/);
  assert.match(webMapSource, /\/markers\/\$\{detail\.iconName\}\.png/);
  assert.doesNotMatch(webMapSource, /어떤 분야인가요\? \(대분류\)/);
});

test("세부 종목은 네 개의 흰색 카드로 빠짐없이 그룹화한다", () => {
  assert.match(webProgramFiltersSource, /title: "스포츠·운동"/);
  assert.match(webProgramFiltersSource, /title: "공연·예술"/);
  assert.match(webProgramFiltersSource, /title: "배움·교육"/);
  assert.match(webProgramFiltersSource, /title: "생활·공간"/);
  assert.match(webProgramFiltersSource, /slice\(0, 22\)/);
  assert.match(webProgramFiltersSource, /slice\(22, 32\)/);
  assert.match(webProgramFiltersSource, /slice\(32, 39\)/);
  assert.match(webProgramFiltersSource, /slice\(39, 44\)/);
  assert.match(webMapSource, /WEB_DETAIL_FILTER_GROUPS\.map/);
  assert.match(webMapStyle, /\.dg-detail-filter-card[^}]*background:\s*#fff;[^}]*box-shadow:/);
});

test("대상 키워드는 성격별 세 구역의 한 카드로 빠짐없이 그룹화한다", () => {
  assert.match(webProgramFiltersSource, /WEB_PROGRAM_PERSONA_GROUPS/);
  assert.match(webProgramFiltersSource, /title: "연령·세대"/);
  assert.match(webProgramFiltersSource, /title: "가족·생활"/);
  assert.match(webProgramFiltersSource, /title: "상황·대상"/);
  assert.match(webProgramFiltersSource, /slice\(1, 9\)/);
  assert.match(webMapSource, /WEB_PROGRAM_PERSONA_GROUPS\.map/);
  assert.match(webMapStyle, /\.dg-persona-filter-card[^}]*margin-top:\s*0/);
});

test("요금 상태 다음 거리 조건이 공통 슬라이더와 실제 위치 기준으로 동작한다", () => {
  assert.match(webMapSource, /PROGRAM_DISTANCE_RADII_KM[^=]*= \[\s*null, 0\.1, 0\.3, 0\.5, 1, 3, 5, 10, 20/);
  assert.match(webMapSource, /function ProgramDistanceSelector/);
  assert.match(webMapSource, /집에서 얼마나 가까운 곳을 찾으세요\?/);
  assert.match(webMapSource, /aria-label="집에서 프로그램까지 검색 반경"/);
  assert.match(webMapSource, /radiusKm !== null && !usesFallbackLocation && distanceMeters/);
  assert.ok(webMapSource.indexOf("<FeeStatusFilterSection") < webMapSource.indexOf("<ProgramDistanceSelector"));
  assert.ok(webMapSource.indexOf("<ProgramDistanceSelector") < webMapSource.indexOf("<PersonaFilterSection"));
  assert.match(webMapStyle, /\.dg-program-radius-card/);
  assert.match(webMapStyle, /\.dg-fee-status-filter-section/);
});

test("조건 화면을 내리면 오른쪽 아래 맨 위로 버튼을 제공한다", () => {
  assert.match(webMapSource, /showScrollTop/);
  assert.match(webMapSource, /scrollTop > 140/);
  assert.match(webMapSource, /aria-label="조건 목록 맨 위로 이동"/);
  assert.match(webMapSource, /scrollTo\(\{ top: 0, behavior: "smooth" \}\)/);
  assert.match(webMapStyle, /\.dg-filter-scroll-top[^}]*position:\s*fixed;[^}]*right:/);
});

test("조건 적용은 사용자 주변 개별 마커로 시작하고 축소 시 조건 행만 군집한다", () => {
  assert.match(webMapSource, /filterFitRequestId/);
  assert.match(webMapSource, /filterFitAppliedSignature/);
  assert.match(webMapSource, /setMapMode\("individual"\)/);
  assert.match(webMapSource, /map\.setCenter\(new maps\.LatLng\(location\.latitude, location\.longitude\)\)/);
  assert.match(webMapSource, /map\.setLevel\(4\)/);
  assert.doesNotMatch(webMapSource, /filterFitProgramSignature/);
  assert.match(webMapSource, /clusterScope: requestedScope/);
  assert.match(webMapSource, /mapFilterBoundsContain\(cached, exactBounds\)/);
  assert.match(webMapSource, /mapBoundsAbortRef\.current\?\.abort\(\)/);
  assert.match(webMapSource, /setMapClusters\(payload\.clusters\)/);
  assert.doesNotMatch(webMapSource, /clusterFilteredWebPrograms\(/);
  assert.match(webMapSource, /setMapMode\("cluster"\)/);
  assert.match(webMapSource, /addListener\(map, "dragstart"[\s\S]*?programFilterActiveRef\.current[\s\S]*?mapBoundsAbortRef\.current\?\.abort\(\)/);
  assert.match(webMapSource, /programFilterActiveRef\.current \? 0 : 420/);
  assert.doesNotMatch(webMapSource, /unfilteredViewportProgramsRef/);
  assert.match(webMapSource, /const items = programs\.filter\(\(program\) =>/);
  assert.match(webMapSource, /onApply=\{\(\) => \{ setLoading\(true\); setShowFilter\(false\); setFilterFitRequestId/);
  assert.match(webMapSource, /setSubjectFilters\(\(current\) => toggleSingleWebDetailFilter\(current, label\)\)/);
  assert.doesNotMatch(webMapSource, /fetchPrograms\(new URLSearchParams\(\{ id: representativeID \}\)\)/);
  assert.doesNotMatch(webMapSource, /map\.setLevel\(4\);\s*setMapClusters\(\[\]\)/);
});

test("조건 군집을 열면 기존 프로그램 카드를 세로로 넘기며 해당 마커로 이동한다", () => {
  assert.match(webMapSource, /function FilteredClusterProgramCarousel/);
  assert.match(webMapSource, /filteredClusterCarouselAnchorRef\.current = carouselAnchor/);
  assert.match(webMapSource, /payload\.mode === "individual"[\s\S]*?filteredClusterCarouselProgramsRef\.current = carouselPrograms/);
  assert.match(webMapSource, /className="dg-filtered-cluster-card-pages" onScroll=\{updateFocusedCard\}/);
  assert.match(webMapSource, /className="dg-program-card" type="button" onClick=\{\(\) => onOpen\(program\)\}/);
  assert.match(webMapSource, /map\.panTo\(coordinate\)/);
  assert.match(webMapSource, /group\.some\(\(program\) => program\.id === filteredClusterFocusedProgramID\)/);
  assert.match(webMapStyle, /\.dg-filtered-cluster-card-pages \{[^}]*scroll-snap-type:\s*y mandatory/);
  assert.match(webMapStyle, /\.dg-filtered-cluster-card-page \{[^}]*scroll-snap-align:\s*start/);
});

test("알림을 저장하지 않아도 알림 하단 패널을 아래로 밀어 닫을 수 있다", () => {
  assert.match(webMapSource, /className="dg-alert-sheet-grabber"/);
  assert.match(webMapSource, /if \(next > 64\) onClose\(\)/);
  assert.match(webMapStyle, /\.dg-alert-sheet-grabber[^}]*touch-action:\s*none/);
});

test("조건 버튼은 키워드 왼쪽에 고정되고 선택 개수 배지를 표시한다", () => {
  assert.match(webMapSource, /function ConditionFilterButton/);
  assert.match(webMapSource, /선택한 조건 \$\{count\}개/);
  assert.ok(webMapSource.indexOf("<ConditionFilterButton") < webMapSource.indexOf("heatShelterMode ? \"active heat\""));
  assert.match(webMapStyle, /\.dg-condition-filter-button[^}]*position:\s*sticky;[^}]*left:\s*0/);
  assert.match(webMapStyle, /\.dg-filter-count-badge[^}]*top:\s*-5px;[^}]*right:\s*-5px/);
});

test("군집은 콘텐츠 너비에 맞추고 조건 키워드와 9+ 수를 한 줄 배지로 표시한다", () => {
  assert.match(webMapStyle, /\.dg-cluster-marker \{[^}]*width:\s*max-content;[^}]*min-width:\s*0;[^}]*padding:\s*7px 9px;[^}]*grid-template-columns:\s*max-content max-content;/);
  assert.match(webMapStyle, /\.dg-cluster-marker strong \{[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;[^}]*white-space:\s*nowrap;/);
  assert.match(webMapStyle, /\.dg-cluster-marker span \{[^}]*white-space:\s*nowrap;/);
  assert.doesNotMatch(webMapStyle, /\.dg-cluster-marker strong \{[^}]*text-overflow:\s*ellipsis/);
  assert.match(webMapStyle, /\.dg-cluster-marker\.is-filtered \{[^}]*grid-template-columns:\s*max-content max-content;[^}]*gap:\s*5px/);
  assert.doesNotMatch(webMapStyle, /\.dg-cluster-marker\.is-filtered span[^}]*background:\s*transparent/);
  assert.match(webMapStyle, /\.dg-cluster-marker\.is-compact-admin \{[^}]*min-width:\s*0;[^}]*column-gap:\s*5px/);
  assert.match(webMapSource, /\["이용가능", "이용가능프로그램", "신청가능한강좌", "신청가능한프로그램"\]/);
  assert.match(webMapSource, /return value >= 9 \? "9\+"/);
  assert.match(webMapSource, /`\$\{clusterKeyword\} \$\{filteredClusterCountLabel\(cluster\.programCount\)\}`/);
  assert.match(webMapSource, /`활동 \$\{cluster\.programCount\}`/);
});

test("웹 실제 경로는 iOS와 같은 동네고고 경로 계약을 서버에서 사용한다", () => {
  assert.match(webRouteSource, /android-route-directions/);
  assert.match(webRouteSource, /facility-transit-info/);
  assert.match(webRouteSource, /for \(const fastRoute of \[true, false\]\)/);
  assert.match(webRouteSource, /fastRoute,/);
  assert.match(webRouteSource, /isEstimated:\s*false/);
  assert.match(webRouteSource, /boardingStation/);
  assert.match(webRouteSource, /alightingStation/);
  assert.match(webRouteSource, /accessWalk/);
  assert.match(webRouteSource, /egressWalk/);
  assert.match(webRouteSource, /transitDistanceMeters/);
  assert.match(webRouteSource, /busRoutes/);
  assert.match(webRouteSource, /import "server-only"/);
  assert.doesNotMatch(webRouteSource, /service_role|sb_secret_/i);
});

test("서울 밖 장거리 대중교통은 iOS와 같은 고속열차 여정을 제공한다", () => {
  assert.match(webRouteSource, /intercity-train-info/);
  assert.match(webRouteSource, /LONG_DISTANCE_METERS\s*=\s*70_000/);
  assert.match(webRouteSource, /buildIntercityConnector/);
  assert.match(webRouteSource, /railWaypoints/);
  assert.match(webRouteSource, /trainType/);
  assert.match(webRouteSource, /departureAt/);
  assert.match(webRouteSource, /travelDate:\s*kstTravelDate\(referenceTime\)/);
  assert.match(webRouteSource, /referenceTime:\s*referenceTime\.toISOString\(\)/);
  assert.match(webMapSource, /고속열차로 가는 길/);
  assert.match(webMapSource, /고속열차 승차/);
  assert.match(webMapSource, /가까운 출발 시간/);
  assert.match(webMapSource, /국토교통부 TAGO 제공/);
  assert.match(webMapStyle, /\.dg-intercity-rail/);
  assert.match(webMapStyle, /\.dg-train-schedule/);
});

test("계정 동기화는 공개키와 사용자 세션·RLS 대상 테이블만 사용한다", () => {
  assert.match(webUserSource, /sb_publishable_/);
  assert.match(webUserSource, /user_favorites/);
  assert.match(webUserSource, /open_run_alerts/);
  assert.match(webUserSource, /family_members/);
  assert.match(webUserSource, /user_legal_consents/);
  assert.match(webUserSource, /app_platform:\s*"web"/);
  assert.match(webUserSource, /WEB_AUTH_CONSENT_VERSION\s*=\s*"2026-08-11"/);
  assert.match(webUserSource, /flowType:\s*"pkce"/);
  assert.doesNotMatch(webUserSource, /service_role|sb_secret_/i);
});

test("웹 로그인과 계정 종속 기능은 단일 활성화 경계로 모두 표시한다", () => {
  assert.match(webMapSource, /const WEB_ACCOUNT_FEATURES_VISIBLE = true/);
  assert.match(webMapSource, /\{ id: "openrun", icon: "♧", label: "오픈런" \}/);
  assert.match(webMapSource, /\{ id: "saved", icon: "♡", label: "찜" \}/);
  assert.match(webMapSource, /\{ id: "me", icon: "♙", label: "내정보" \}/);
  assert.match(webMapSource, /\.\.\.\(WEB_ACCOUNT_FEATURES_VISIBLE \? ACCOUNT_TABS : \[\]\)/);
  assert.match(webMapSource, /if \(!WEB_ACCOUNT_FEATURES_VISIBLE \|\| !webAuthConfigured\(\)\) return/);
  assert.match(webMapSource, /WEB_ACCOUNT_FEATURES_VISIBLE && <button type="button" className="dg-mobile-bell"/);
  assert.match(webMapSource, /WEB_ACCOUNT_FEATURES_VISIBLE && <button type="button" onClick=\{\(\) => openMapTool\("family"\)\}/);
  assert.match(webMapSource, /WEB_ACCOUNT_FEATURES_VISIBLE && showAuthDialog && !session && <WebAuthDialog/);
  assert.match(webMapSource, /accountFeaturesVisible && <button type="button" className=\{`dg-ios-action-button favorite/);
  assert.match(webMapSource, /accountFeaturesVisible && <button type="button" className=\{reminderIDs\.includes\(program\.id\)/);
  assert.match(webMapSource, /className=\{!WEB_ACCOUNT_FEATURES_VISIBLE \? "dg-public-nav" : undefined\}/);
});

test("웹 로그인은 iOS와 같은 동의 확인 뒤 제공자를 선택한다", () => {
  assert.match(webMapSource, /로그인하고 안전하게 저장/);
  assert.match(webMapSource, /로그인 이용 확인/);
  assert.match(webMapSource, /만 14세 이상이며/);
  assert.match(webMapSource, /동의하고 계속/);
  assert.match(webMapSource, /Kakao로 계속/);
  assert.match(webMapSource, /Apple로 계속/);
  assert.match(webMapSource, /Google로 계속/);
  assert.match(webMapStyle, /\.dg-auth-dialog/);
});

test("모바일 웹은 iOS형 전체 화면 탭과 지도 시트를 사용하고 PC 분할 구조는 유지한다", () => {
  const compactMobileStyle = webMapStyle.slice(webMapStyle.indexOf("@media (max-width: 520px)"));
  assert.match(webMapSource, /dg-mobile-map-chrome/);
  assert.match(webMapSource, /dg-tab-\$\{tab\}/);
  assert.match(webMapSource, /dg-side-panel-overlay/);
  assert.match(webMapSource, /openNearbyProgramCarousel/);
  assert.match(webMapSource, /이렇게 검색해보세요/);
  assert.match(webMapSource, /나의 프로그램/);
  assert.match(webMapSource, /가족을 위한 프로그램/);
  assert.match(webMapStyle, /grid-template-columns:\s*88px 430px minmax\(0,\s*1fr\)/);
  assert.match(webMapStyle, /\.dg-side-panel-map:not\(\.dg-side-panel-overlay\)\s*\{\s*display:\s*none/);
  assert.match(webMapStyle, /\.dg-mobile-map-header/);
  assert.match(webMapSource, /type PlaceSheetSnap = "hidden" \| "collapsed" \| "expanded"/);
  assert.match(webMapSource, /function placeSheetHeights\(viewportHeight/);
  assert.match(webMapSource, /ref=\{grabberRef\} className="dg-place-sheet-grabber"/);
  assert.match(webMapSource, /dg-place-sheet-\$\{snap\}/);
  assert.match(webMapSource, /setDragHeight\(Math\.max\(heights\.hidden, Math\.min\(heights\.expanded/);
  assert.match(webMapSource, /if \(nextSnap === "hidden"\) dismiss\(\)/);
  assert.match(webMapStyle, /\.dg-place-sheet-expanded \{[^}]*--dg-place-sheet-height:\s*calc\(100dvh - 82px\)/);
  assert.match(webMapStyle, /\.dg-place-sheet-hidden \{[^}]*--dg-place-sheet-height:\s*0px;[^}]*opacity:\s*0/);
  assert.match(webMapStyle, /\.dg-place-sheet-dragging \{\s*transition:\s*none/);
  assert.match(webMapStyle, /\.dg-place-sheet-grabber \{[^}]*touch-action:\s*none/);
  assert.match(webMapStyle, /\.dg-side-panel-overlay\s*\{\s*z-index:\s*80;\s*bottom:\s*0/);
  assert.match(webMapSource, /type MobileSheetSnap = "hidden" \| "collapsed" \| "medium" \| "expanded"/);
  assert.match(webMapSource, /window\.addEventListener\("pointermove", onPointerMove/);
  assert.match(webMapSource, /window\.addEventListener\("pointerup", onPointerEnd\)/);
  assert.match(webMapSource, /window\.addEventListener\("touchend", onTouchEnd\)/);
  assert.match(webMapSource, /ref=\{sheetGrabberRef\}/);
  assert.match(webMapSource, /mapRequestIDRef/);
  assert.doesNotMatch(webMapSource, /requestRef\.current\?\.abort\(\)/);
  assert.match(webMapStyle, /\.dg-mobile-sheet-grabber/);
  assert.match(webMapStyle, /touch-action:\s*none/);
  assert.match(webMapSource, /목적지까지 가는 길/);
  assert.match(webMapSource, /routeSheetCollapsed/);
  assert.match(webMapSource, /routeSheetGrabberRef/);
  assert.match(webMapStyle, /\.dg-mobile-sheet-hidden/);
  assert.match(webMapStyle, /--dg-mobile-sheet-height:\s*0px/);
  assert.match(webMapStyle, /\.dg-route-restore-bar/);
  assert.match(webMapStyle, /\.dg-route-detail-sheet-collapsed/);
  assert.match(webMapStyle, /\.dg-route-sheet-grabber\s*\{[\s\S]*?min-height:\s*28px/);
  assert.match(webMapStyle, /\.dg-detail-hero\s*\{\s*padding:\s*8px 14px 12px/);
  assert.match(webMapStyle, /\.dg-detail-hero h1\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);
  assert.match(compactMobileStyle, /\.dg-route-detail-sheet\s*\{[^}]*top:\s*max\(8px,[^}]*left:\s*8px;[^}]*right:\s*8px;[^}]*bottom:\s*0/);
  assert.ok(compactMobileStyle.indexOf(".dg-route-detail-sheet") > compactMobileStyle.indexOf(".dg-side-panel { inset: 0 0 74px;"), "520px 상세 패널 여백 규칙은 공통 inset 뒤에 있어야 합니다.");
});

test("조건·주변 프로그램은 같은 지도 하단 카드와 분류 확장·포커스 효과를 사용한다", () => {
  assert.match(webMapSource, /mapProgramCarouselSource/);
  assert.match(webMapSource, /openNearbyProgramCarousel/);
  assert.match(webMapSource, /title=\{mapProgramCarouselSource === "nearby" \? "주변 프로그램" : "조건 프로그램"\}/);
  assert.match(webMapSource, /dg-carousel-filter-toggle/);
  assert.match(webMapSource, /프로그램 분류 접기/);
  assert.match(webMapSource, /searchResultCategoryIDs\(program\)\.includes\(category\)/);
  assert.match(webMapSource, /if \(dragOffset > 84\) onClose\(\)/);
  assert.match(webMapSource, /focusedCarouselProgram[\s\S]*?dg-map-marker is-selected/);
  assert.match(webMapSource, /className="dg-carousel-map-action"[\s\S]*?onClick=\{\(\) => onFocus\(program\)\}/);
  assert.match(webMapStyle, /\.dg-filtered-cluster-card-page \{[^}]*align-items:\s*center/);
  assert.match(webMapStyle, /\.dg-carousel-map-action \{[^}]*border-radius:50%/);
  assert.match(webMapStyle, /\.dg-map-marker\.is-selected \{ animation:\s*dg-selected-marker-border-blink/);
  assert.doesNotMatch(webMapStyle, /dg-selected-marker-shimmer/);
});
