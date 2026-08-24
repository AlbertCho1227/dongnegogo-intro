import test from "node:test";
import assert from "node:assert/strict";
import {
  clusterDisplayAreaName,
  clusterFilteredWebPrograms,
  resolvedClusterAreaName,
  WEB_MAP_CLUSTER_DISPLAY_LIMIT,
  webMapScopeForRadius,
} from "../lib/web-map-cluster.ts";

test("iOS와 같은 반경에서 개별→동→구→시 군집으로 전환한다", () => {
  assert.equal(webMapScopeForRadius(1.79, "individual"), "individual");
  assert.equal(webMapScopeForRadius(1.8, "individual"), "localArea");
  assert.equal(webMapScopeForRadius(5.49, "localArea"), "localArea");
  assert.equal(webMapScopeForRadius(6.2, "localArea"), "neighborhood");
  assert.equal(webMapScopeForRadius(16, "neighborhood"), "district");
  assert.equal(webMapScopeForRadius(60, "district"), "city");
  assert.equal(webMapScopeForRadius(210, "city"), "province");
});

test("조건 프로그램만 현재 행정구역 단계로 군집하고 키워드와 실제 건수를 보존한다", () => {
  const programs = [
    { id: "a", latitude: 37.60, longitude: 127.01, address: "서울특별시 성북구 정릉2동", area: "성북구" },
    { id: "b", latitude: 37.61, longitude: 127.02, address: "서울특별시 성북구 정릉2동", area: "성북구" },
    { id: "c", latitude: 35.16, longitude: 129.16, address: "부산광역시 해운대구 우2동", area: "해운대구" },
  ];
  const local = clusterFilteredWebPrograms(programs, "localArea", "수영");
  assert.equal(local.length, 2);
  assert.equal(local.find((cluster) => cluster.areaName === "정릉2동")?.programCount, 2);
  assert.equal(local[0].categoryName, "수영");
  const district = clusterFilteredWebPrograms(programs, "district", "수영");
  assert.deepEqual(new Set(district.map((cluster) => cluster.areaName)), new Set(["성북구", "해운대구"]));
});

test("확대·축소 경계에는 iOS와 같은 히스테리시스를 적용한다", () => {
  assert.equal(webMapScopeForRadius(1.56, "localArea"), "localArea");
  assert.equal(webMapScopeForRadius(1.54, "localArea"), "individual");
  assert.equal(webMapScopeForRadius(15.6, "neighborhood"), "neighborhood");
  assert.equal(webMapScopeForRadius(5, "neighborhood"), "neighborhood");
});

test("군집 지역명과 화면 상한은 iOS 표시 계약을 따른다", () => {
  assert.equal(clusterDisplayAreaName("정릉2동"), "정릉2동");
  assert.equal(clusterDisplayAreaName("성북구"), "성북구");
  assert.equal(clusterDisplayAreaName("서울특별시"), "서울");
  assert.equal(clusterDisplayAreaName("경기도"), "경기");
  assert.equal(resolvedClusterAreaName("localArea", "문화지구", "서울특별시", "성북구", "정릉2동"), "정릉2동");
  assert.equal(resolvedClusterAreaName("neighborhood", "출구", "서울특별시", "성북구", "정릉2동"), "성북구");
  assert.equal(resolvedClusterAreaName("city", "장안구", "경기도", "수원시 장안구", "정자1동"), "수원시");
  assert.equal(resolvedClusterAreaName("city", "서울특별시", "서울특별시", "성북구", "정릉2동"), "서울");
  assert.deepEqual(WEB_MAP_CLUSTER_DISPLAY_LIMIT, {
    localArea: 12, neighborhood: 22, district: 18, city: 16, province: 18,
  });
});
