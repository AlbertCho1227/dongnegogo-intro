import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dominantProgram, programIconName } from "../lib/web-icon-mapper.ts";
import { parseSearchIntent, searchPrograms } from "../lib/web-search-engine.ts";

const webMapSource = readFileSync(new URL("../app/web/web-map-app.tsx", import.meta.url), "utf8");
const webMapStyle = readFileSync(new URL("../app/web/web-map.css", import.meta.url), "utf8");
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
  assert.deepEqual(intent.chips, ["수영", "무료", "5km 이내"]);
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
  assert.match(webMapStyle, /\.dg-calendar-grid/);
  assert.match(webMapStyle, /\.dg-route-endpoint/);
  assert.match(webMapStyle, /\.dg-nearby-map-marker/);
  assert.match(webMapSource, /function KakaoRoutePreview/);
  assert.match(webMapSource, /function RouteJourneyDetails/);
  assert.match(webMapSource, /activeRoute\s*\|\|\s*routeSheetCollapsed/);
  assert.match(webMapStyle, /\.dg-route-preview/);
  assert.match(webMapStyle, /\.dg-journey-card/);
  assert.match(webMapStyle, /\.dg-map-link-card/);
  assert.doesNotMatch(webMapStyle, /\.dg-map-tools button:nth-child\(2\).*display:\s*none/);
});

test("웹 실제 경로는 iOS와 같은 동네고고 경로 계약을 서버에서 사용한다", () => {
  assert.match(webRouteSource, /android-route-directions/);
  assert.match(webRouteSource, /facility-transit-info/);
  assert.match(webRouteSource, /fastRoute:\s*true/);
  assert.match(webRouteSource, /isEstimated:\s*false/);
  assert.match(webRouteSource, /import "server-only"/);
  assert.doesNotMatch(webRouteSource, /service_role|sb_secret_/i);
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
});
