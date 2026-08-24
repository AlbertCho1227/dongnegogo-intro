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
    "세부 종목 선택",
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
  assert.match(webMapSource, /dg-ios-share-icon/);
  assert.match(webMapSource, /dg-ios-map-icon/);
  assert.match(webMapSource, /mobileMapPanel && !placeSheet && !sidePanelOverlay/);
  assert.match(webMapSource, /<em>내리면 패널 숨기기<\/em>/);
  assert.match(webMapSource, /locationRequestState === "checking"/);
  assert.match(webMapSource, /locationError\.code === 1/);
  assert.match(webMapSource, /timeout:\s*20_000/);
  assert.ok(webMapSource.indexOf('className="dg-location-guide"') < webMapSource.indexOf('className="dg-route-map-guide"'), "현재 위치 안내가 지도 선택 안내보다 먼저 표시되어야 합니다.");
  assert.doesNotMatch(webMapStyle, /\.dg-map-tools button:nth-child\(2\).*display:\s*none/);
});

test("군집 마커는 지역명과 강좌 수를 말줄임 없이 표시한다", () => {
  assert.match(webMapStyle, /\.dg-cluster-marker \{[^}]*width:\s*max-content;[^}]*min-width:\s*132px;[^}]*grid-template-columns:\s*max-content max-content;/);
  assert.match(webMapStyle, /\.dg-cluster-marker strong \{[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;[^}]*white-space:\s*nowrap;/);
  assert.match(webMapStyle, /\.dg-cluster-marker span \{[^}]*white-space:\s*nowrap;/);
  assert.doesNotMatch(webMapStyle, /\.dg-cluster-marker strong \{[^}]*text-overflow:\s*ellipsis/);
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
  assert.match(webMapSource, /openMapTool\("programs"\)/);
  assert.match(webMapSource, /이렇게 검색해보세요/);
  assert.match(webMapSource, /나의 프로그램/);
  assert.match(webMapSource, /가족을 위한 프로그램/);
  assert.match(webMapStyle, /grid-template-columns:\s*88px 430px minmax\(0,\s*1fr\)/);
  assert.match(webMapStyle, /\.dg-side-panel-map:not\(\.dg-side-panel-overlay\)\s*\{\s*display:\s*none/);
  assert.match(webMapStyle, /\.dg-mobile-map-header/);
  assert.match(webMapStyle, /\.dg-place-sheet::before/);
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
