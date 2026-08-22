import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";

test("HTTPS apex 요청을 보안 헤더와 함께 정식 주소로 이동한다", async () => {
  const response = await worker.fetch(new Request("https://dongnegogo.com/web?q=교육"));

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://www.dongnegogo.com/web?q=%EA%B5%90%EC%9C%A1");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
});

test("평문 apex 요청은 HTTPS로 이동하고 HSTS를 잘못 전송하지 않는다", async () => {
  const response = await worker.fetch(new Request("http://dongnegogo.com/privacy"));

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://www.dongnegogo.com/privacy");
  assert.equal(response.headers.get("strict-transport-security"), null);
});

test("잘못 연결된 호스트에는 보안 처리된 404를 반환한다", async () => {
  const response = await worker.fetch(new Request("https://unexpected.example/"));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(response.headers.get("x-permitted-cross-domain-policies"), "none");
});
