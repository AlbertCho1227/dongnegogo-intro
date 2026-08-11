import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function collectTextArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const texts = [];

  for (const entry of entries) {
    const url = new URL(entry.name, directory.href.endsWith("/") ? directory : new URL(`${directory.href}/`));
    if (entry.isDirectory()) {
      texts.push(...await collectTextArtifacts(url));
    } else if (/\.(?:html|js|mjs|css)$/i.test(entry.name)) {
      texts.push(await readFile(url, "utf8"));
    }
  }

  return texts;
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("동네고고 서비스 소개 홈페이지를 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /우리(?:&nbsp;|\s)+(?:<!-- -->)?<span[^>]*>주변의 배움과 즐거움을/);
  assert.match(html, /강좌와 행사가 지도 위에 아이콘으로 떠 있어요/);
  assert.match(html, /신청까지 네 걸음이면 충분해요/);
  assert.match(html, /AI 쉬운 설명/);
  assert.match(html, /오픈런 알림/);
  assert.match(html, /가족 도우미 모드/);
  assert.match(html, /39,844/);
  assert.match(html, /16,929/);
  assert.match(html, /2,390/);
  assert.match(html, /12,960/);
  assert.match(html, /9,315/);
  assert.match(html, /2026년 8월 11일(?:<!-- -->)? 기준/);
  assert.match(html, /활성 프로그램 기준/);
  assert.match(html, /매일 갱신/);
  assert.match(html, /공연은 다른 분야와 중복될 수 있어요/);
  assert.match(html, /data-stats-source="fallback"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("지도 SDK와 데이터 클라이언트를 웹 문서에 포함하지 않는다", async () => {
  const response = await render();
  const html = await response.text();
  assert.doesNotMatch(html, /dapi\.kakao\.com|maps\/sdk\.js|NEXT_PUBLIC_KAKAO_MAP_JS_KEY/i);
  assert.doesNotMatch(html, /supabase\.co|NEXT_PUBLIC_SUPABASE|navigator\.geolocation/i);
});

test("첨부된 원안의 화면 이미지와 레이아웃 문구를 그대로 사용한다", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /uploads\/B93E5F67-2560-45D3-A5A5-08A0A8E75E1B\.png/);
  assert.match(html, /uploads\/Screenshot 2026-08-11 at 3\.35\.17 PM\.png/);
  assert.match(html, /uploads\/b24d3c0f-525c-43b8-b8fc-27b46f137b6f\.png/);
  assert.match(html, /assets\/beodeuli-wave\.png/);
  assert.doesNotMatch(html, /support\.js|text\/x-dc|<x-dc/i);
});

test("웹 디자인 원본 파일은 첨부 ZIP과 바이트 단위로 동일하다", async () => {
  const source = await readFile(new URL("app/original-design.dc.html", projectRoot));
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    "a8b25f7b8dc629f1b99c49d98a80b5f7c567d64a36e8957f38773a8cc55e7305",
  );
});

test("통계 모듈은 서버 전용 native fetch와 하루 캐시만 사용한다", async () => {
  const source = await readFile(new URL("lib/program-stats.ts", projectRoot), "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /DONGNEGOGO_SUPABASE_URL/);
  assert.match(source, /DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /startsWith\("sb_publishable_"\)/);
  assert.match(source, /get_public_program_stats_v1/);
  assert.match(source, /unstable_cache/);
  assert.match(source, /86_400/);
  assert.match(source, /FALLBACK_RETRY_SECONDS = 300/);
  assert.match(source, /REQUEST_TIMEOUT_MS = 2_000/);
  assert.match(source, /await fetch\(/);
  assert.doesNotMatch(source, /@supabase\/supabase-js|createClient|NEXT_PUBLIC_/);
});

test("브라우저 산출물에는 Kakao SDK와 Supabase 클라이언트가 없다", async () => {
  const clientArtifacts = (await collectTextArtifacts(new URL("dist/client/", projectRoot))).join("\n");
  assert.doesNotMatch(
    clientArtifacts,
    /dapi\.kakao\.com|maps\/sdk\.js|NEXT_PUBLIC_KAKAO|@supabase\/supabase-js|createClient\(|NEXT_PUBLIC_SUPABASE|DONGNEGOGO_SUPABASE_|support\.js|DCLogic|<x-dc/i,
  );
});
