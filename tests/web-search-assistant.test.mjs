import test from "node:test";
import assert from "node:assert/strict";
import {
  hasAmbiguousAdministrativeSuggestions,
  parseSearchIntent,
  preferredPlaceSuggestion,
  searchPrograms,
  resolveSearchCityScope,
  searchAroundPlacePrograms,
  searchResultCategories,
  searchSuggestionQuery,
  shouldRequestPlaceSuggestions,
  strongOutOfAreaTitleSuggestion,
} from "../lib/web-search-engine.ts";

function program(overrides = {}) {
  return {
    id: "sample", name: "일반 프로그램", category: "기타", field: "", facility: "동네센터",
    room: null, address: "서울특별시 종로구 세종로", area: "종로구", latitude: 37.5724, longitude: 126.9769,
    isFree: true, feeText: "무료", status: "접수중", audiences: ["성인"], scheduleText: "상시",
    periodText: null, receiptStart: null, receiptEnd: null, applyUrl: null, phone: null, summary: "",
    requirement: null, preparation: null, imageUrl: null, source: "공개데이터",
    rawCategory: "기타", rawField: "", maxClassName: null, minClassName: null, isSeniorRecommended: false,
    ...overrides,
  };
}

test("프로그램명의 동아리를 행정리로 오해하지 않는다", () => {
  const intent = parseSearchIntent("한국무용동아리");
  assert.deepEqual(intent.areaTerms, []);
  assert.ok(intent.generalTerms.includes("한국무용동아리"));
});

test("지역·장소·종목을 분리해 자동완성 요청어를 만든다", () => {
  assert.equal(searchSuggestionQuery("광화문 전시"), "광화문");
  assert.equal(searchSuggestionQuery("부산 수영구에서 무료 요가"), "부산 수영구");
  assert.equal(searchSuggestionQuery("무료 수영"), "");
  assert.equal(shouldRequestPlaceSuggestions("광화문 전시"), true);
  assert.equal(shouldRequestPlaceSuggestions("무료 수영"), false);
});

test("동명이 행정지역은 사용자가 전체 경로를 선택하도록 유지한다", () => {
  const suggestions = ["경상남도 창원시 의창구 중동", "부산광역시 해운대구 중동"].map((displayName) => ({
    displayName, placeKind: "administrative", latitude: 37, longitude: 127, programCount: 3, confidence: 100,
  }));
  assert.equal(hasAmbiguousAdministrativeSuggestions("중동", suggestions), true);
  assert.equal(hasAmbiguousAdministrativeSuggestions("부산광역시 해운대구 중동", suggestions), false);
});

test("도시 검색 범위는 광역시 또는 도의 시·군 단위로 정한다", () => {
  assert.deepEqual(resolveSearchCityScope(parseSearchIntent("무료 수영"), "서울특별시 종로구"), {
    displayName: "서울", regionPath: "서울", candidateAreaTerms: ["서울"],
  });
  assert.deepEqual(resolveSearchCityScope(parseSearchIntent("무료 요가"), "경기도 성남시 분당구"), {
    displayName: "성남", regionPath: "경기 성남시", candidateAreaTerms: ["경기", "성남시"],
  });
  assert.deepEqual(resolveSearchCityScope(parseSearchIntent("부산 공존의 세계"), "서울특별시 종로구"), {
    displayName: "부산", regionPath: "부산", candidateAreaTerms: ["부산"],
  });
});

test("현재 도시 밖의 정확한 프로그램 제목은 지역 검색을 먼저 제안한다", () => {
  const suggestion = strongOutOfAreaTitleSuggestion(
    "공존의 세계",
    { displayName: "서울", regionPath: "서울", candidateAreaTerms: ["서울"] },
    [program({ name: "공존의 세계", address: "부산광역시 해운대구", area: "해운대구" })],
  );
  assert.deepEqual(suggestion, {
    regionName: "부산", programName: "공존의 세계", suggestedQuery: "부산 공존의 세계",
  });
});

test("대구 검색에 부산 해운대구가 문자열 일부로 섞이지 않는다", () => {
  const intent = parseSearchIntent("대구 클래식");
  const results = searchPrograms([
    program({ id: "daegu", name: "대구 클래식", address: "대구광역시 중구 중앙대로", area: "중구" }),
    program({ id: "busan", name: "부산 클래식", address: "부산광역시 해운대구 양운로", area: "해운대구" }),
  ], intent, { latitude: 37.5, longitude: 127 });
  assert.deepEqual(results.map((item) => item.program.id), ["daegu"]);
});

test("장소 검색은 장소 문자열을 빼고 실제 좌표·반경과 종목 조건을 적용한다", () => {
  const place = { displayName: "서울특별시 종로구 광화문광장", placeKind: "facility", latitude: 37.5724, longitude: 126.9769, programCount: 12, confidence: 100 };
  const result = searchAroundPlacePrograms([
    program({ id: "near-exhibition", name: "빛나는 전시", category: "전시" }),
    program({ id: "near-swim", name: "자유 수영", category: "체육" }),
    program({ id: "far-exhibition", name: "먼 전시", category: "전시", latitude: 37.65, longitude: 127.1 }),
  ], "광화문 전시", place, 1);
  assert.deepEqual(result.results.map((item) => item.program.id), ["near-exhibition"]);
  assert.deepEqual(result.intent.areaTerms, []);
  assert.ok(result.intent.chips.includes("1km 이내"));
});

test("장소 자동 검색은 좌표가 있고 신뢰도 높은 후보를 우선한다", () => {
  const intent = parseSearchIntent("광화문 전시");
  const place = preferredPlaceSuggestion("광화문 전시", intent, [{
    displayName: "서울특별시 종로구 광화문광장", placeKind: "facility", latitude: 37.5724, longitude: 126.9769, programCount: 12, confidence: 100,
  }]);
  assert.equal(place?.displayName, "서울특별시 종로구 광화문광장");
});

test("검색 결과 다중 분류는 iOS와 같은 사용자 언어 칩을 만든다", () => {
  const categories = searchResultCategories([
    program({ name: "어린이 미술 체험 교실", summary: "수채화 만들기" }),
    program({ id: "concert", name: "여름 음악회 공연" }),
  ]);
  const labels = categories.map((item) => item.label);
  assert.ok(labels.includes("교육"));
  assert.ok(labels.includes("강좌"));
  assert.ok(labels.includes("예술"));
  assert.ok(labels.includes("체험"));
  assert.ok(labels.includes("공연"));
});
