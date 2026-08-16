import assert from "node:assert/strict";
import test from "node:test";

import { dedupeImagesByContent, imageContentIdentity } from "../lib/image-content-identity.ts";

const hash = "38e1990290528a884357e3d8e5d9bbca95a353e72f53bbbe8597630a916e83f0";

test("eShare 포스터와 공유누리 시설 사진의 저장 경로가 달라도 같은 콘텐츠로 판정한다", () => {
  const poster = `https://project.supabase.co/storage/v1/object/public/facility-media/program-posters/${hash}.jpg`;
  const facility = `https://project.supabase.co/storage/v1/object/public/facility-media/verified/facility-key/${hash}.jpg`;

  assert.equal(imageContentIdentity(null, poster), `sha256:${hash}`);
  assert.equal(imageContentIdentity(hash.toUpperCase(), facility), `sha256:${hash}`);
});

test("해시가 없는 동일 URL의 리사이즈 쿼리 변형도 하나로 판정한다", () => {
  const large = "https://cdn.example.com/poster.jpg?width=1200&quality=90";
  const thumbnail = "https://cdn.example.com/poster.jpg?width=320&quality=70";

  assert.equal(imageContentIdentity(null, large), imageContentIdentity(null, thumbnail));
});

test("실제 파일 경로가 다른 이미지는 별도로 유지한다", () => {
  assert.notEqual(
    imageContentIdentity(null, "https://cdn.example.com/poster-one.jpg"),
    imageContentIdentity(null, "https://cdn.example.com/poster-two.jpg"),
  );
});

test("중복 사진은 한 장만 유지하면서 출처와 이용조건을 합친다", () => {
  const contentIdentity = `sha256:${hash}`;
  const result = dedupeImagesByContent([
    {
      contentIdentity,
      url: "https://example.com/program-poster.jpg",
      thumbnailUrl: null,
      attribution: "eShare",
      license: null,
      licenseUrl: null,
    },
    {
      contentIdentity,
      url: "https://example.com/facility-photo.jpg",
      thumbnailUrl: "https://example.com/facility-photo-thumb.jpg",
      attribution: "공유누리",
      license: "공공누리 제1유형",
      licenseUrl: "https://www.kogl.or.kr/info/licenseType1.do",
    },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.com/program-poster.jpg");
  assert.equal(result[0].thumbnailUrl, "https://example.com/facility-photo-thumb.jpg");
  assert.equal(result[0].attribution, "eShare · 공유누리");
  assert.equal(result[0].license, "공공누리 제1유형");
  assert.equal(result[0].licenseUrl, "https://www.kogl.or.kr/info/licenseType1.do");
});
