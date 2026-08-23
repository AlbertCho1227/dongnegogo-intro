import test from "node:test";
import assert from "node:assert/strict";
import {
  nearbyKakaoMapURL,
  nearbyMapSearchQuery,
  nearbyNaverMapURL,
  normalizedNearbyMapAddress,
} from "../lib/web-map-links.ts";

function place(overrides = {}) {
  return {
    id: 1,
    name: "하남돼지집",
    branchName: "정릉점",
    placeType: "restaurant",
    categoryLargeName: "음식",
    categoryMediumName: "한식",
    categorySmallName: "돼지고기 구이/찜",
    phone: null,
    address: "서울특별시 성북구 정릉로 250 (정릉동), 1층 101호",
    longitude: 127.011370025917,
    latitude: 37.6042618458543,
    distanceMeters: 30,
    businessStatusName: "영업중",
    parkingLotID: null,
    parkingLotName: null,
    parkingDistanceMeters: null,
    parkingAvailabilityStatus: null,
    parkingAvailableSpaces: null,
    ...overrides,
  };
}

test("iOS와 같은 가게명·도로명 검색어를 만들고 층·호수 설명은 제외한다", () => {
  assert.equal(normalizedNearbyMapAddress(place().address), "서울특별시 성북구 정릉로 250");
  assert.equal(nearbyMapSearchQuery(place()), "하남돼지집 정릉점 서울특별시 성북구 정릉로 250");
  assert.equal(nearbyMapSearchQuery(place({ name: "하남돼지집 정릉점" })), "하남돼지집 정릉점 서울특별시 성북구 정릉로 250");
});

test("네이버 지도는 업체 색인 유무와 무관하게 도로명 주소를 우선 검색한다", () => {
  const url = new URL(nearbyNaverMapURL(place()));
  assert.equal(url.origin, "https://map.naver.com");
  assert.equal(decodeURIComponent(url.pathname), "/p/search/서울특별시 성북구 정릉로 250");
  assert.equal(url.search, "");
  assert.equal(decodeURIComponent(new URL(nearbyNaverMapURL(place({ address: null }))).pathname), "/p/search/하남돼지집 정릉점");
});

test("카카오 지도는 업체 색인 유무와 무관하게 실제 좌표 마커를 연다", () => {
  const url = new URL(nearbyKakaoMapURL(place()));
  assert.equal(url.origin, "https://map.kakao.com");
  assert.equal(decodeURIComponent(url.pathname), "/link/map/하남돼지집 정릉점,37.6042618458543,127.011370025917");
  assert.equal(url.search, "");
});
