import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dominantProgram, programIconName } from "../lib/web-icon-mapper.ts";
import { parseSearchIntent, searchPrograms } from "../lib/web-search-engine.ts";

const webMapSource = readFileSync(new URL("../app/web/web-map-app.tsx", import.meta.url), "utf8");
const webMapStyle = readFileSync(new URL("../app/web/web-map.css", import.meta.url), "utf8");

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
    "최근 7일 동안 열어본 프로그램이에요",
  ]) assert.ok(webMapSource.includes(copy), `${copy} UI가 빠졌습니다.`);
  assert.match(webMapSource, /aria-label="이전 달"/);
  assert.match(webMapSource, /aria-label="다음 달"/);
  assert.match(webMapSource, /\[100, 300, 500, 1000\]/);
  assert.match(webMapStyle, /\.dg-calendar-grid/);
  assert.doesNotMatch(webMapStyle, /\.dg-map-tools button:nth-child\(2\).*display:\s*none/);
});
