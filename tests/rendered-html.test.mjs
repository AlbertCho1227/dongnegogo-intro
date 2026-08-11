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

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("동네고고 서비스 소개 홈페이지를 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /data-r="hero-title"[\s\S]*?우리 주변의 배움과[\s\S]*?data-r="mobile-break"[\s\S]*?즐거움을 한눈에[\s\S]*?동네고고 하나로/);
  assert.match(html, /data-r="map-heading"[\s\S]*?강좌와 행사가 지도 위에[\s\S]*?data-r="mobile-break"[\s\S]*?아이콘으로 떠 있어요/);
  assert.match(html, /신청까지 네 걸음이면[\s\S]*?data-r="mobile-break"[\s\S]*?충분해요/);
  assert.match(html, /data-r="four-step-heading"/);
  assert.match(html, /assets\/beodeuli-search\.png/);
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

test("휴대폰 반응형 보정과 두 장 화면 넘기기를 제공한다", async () => {
  const response = await render();
  const html = await response.text();
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  const behavior = await readFile(new URL("app/original-design-behavior.tsx", projectRoot), "utf8");

  assert.match(html, /data-r="hero-mascot"/);
  assert.match(html, /data-r="primary-nav"/);
  assert.match(html, /data-r="hero-badge"/);
  assert.match(html, /data-r="hero-badge-secondary">신청 링크 확인됨/);
  assert.match(html, /data-r="hero-category-break"/);
  assert.match(html, /data-r="route-heading"[\s\S]*?가는 길과 도착 풍경까지[\s\S]*?data-r="mobile-break"[\s\S]*?미리[\s\S]*?data-r="mobile-only"[\s\S]*?확인/);
  assert.match(html, /data-r="persona-heading"[\s\S]*?누구에게나 딱 맞는[\s\S]*?data-r="mobile-break"[\s\S]*?동네 생활/);
  assert.match(html, /data-r="stories-heading"[\s\S]*?우리 동네 모든 무료[\s\S]*?data-r="mobile-break"[\s\S]*?공공 혜택,[\s\S]*?지도 하나로/);
  assert.match(html, /data-r="hero-search"/);
  assert.match(html, /data-r="route-carousel"/);
  assert.match(html, /data-r="route-pager"/);
  assert.match(html, /data-route-page="0"[^>]*aria-current="true"/);
  assert.match(html, /data-route-page="1"[^>]*aria-current="false"/);
  assert.match(html, /data-r="proof-actions"/);
  assert.match(html, /data-r="openrun-timing"/);
  assert.match(html, /data-r="family-actions"/);
  assert.match(html, /data-r="closing-cta-copy"/);
  assert.match(css, /@media \(max-width:\s*1023px\)[\s\S]*?\[data-r="hero-mascot"\]\s*\{\s*margin-top:\s*88px;\s*\}/);
  assert.match(css, /\[data-r="primary-nav"\][\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\[data-r="hero-badge"\][\s\S]*?grid-template-areas:[\s\S]*?"star primary"[\s\S]*?"secondary secondary"/);
  assert.match(css, /\[data-r="hero-category-separator"\]\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /\[data-r="hero-category-break"\]\s*\{\s*display:\s*inline;\s*\}/);
  assert.match(css, /\[data-r="mobile-break"\], \[data-r="mobile-only"\]\s*\{\s*display:\s*inline;\s*\}/);
  assert.match(css, /\[data-r="desktop-only"\]\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /\[data-r="responsive-line"\]\s*\{\s*white-space:\s*nowrap;\s*\}/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /\[data-r="proof-actions"\][\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\[data-r="openrun-timing"\][\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\[data-r="openrun-timing"\]\s*>\s*\*[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\[data-r="family-actions"\]\s*>\s*\*[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\[data-r="closing-cta-copy"\]\s*>\s*div:first-child[\s\S]*word-break:\s*keep-all/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*?main \[data-r="cta"\] \[data-r="closing-cta-copy"\]\s*\{[\s\S]*?width:\s*100%;[\s\S]*?padding:\s*24px 20px\s*!important/);
  assert.match(behavior, /carousel\.scrollTo/);
  assert.match(behavior, /aria-current/);
  assert.match(html, /data-r="to-top"[^>]*aria-label="위로 가기"/);
  assert.match(css, /\[data-r="to-top"\]\s*\{[\s\S]*?left:\s*auto\s*!important;[\s\S]*?display:\s*flex\s*!important;/);
  assert.match(css, /\[data-r="to-top"\]:focus-visible\s*\{[\s\S]*?outline:/);
  assert.match(behavior, /window\.scrollTo\(\{ top: 0, behavior:/);
  assert.match(behavior, /prefers-reduced-motion:\s*reduce/);
  assert.match(behavior, /button\.tabIndex\s*=\s*visible \? 0 : -1/);
});

test("데스크톱 히어로와 통계를 하나의 연두색 영역으로 이어준다", async () => {
  const response = await render();
  const html = await response.text();
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  const statsIndex = html.indexOf('class="trust-strip"');
  const mascotIndex = html.indexOf('data-r="hero-mascot"');
  const mapIndex = html.indexOf('id="map"');

  assert.ok(statsIndex > 0 && mascotIndex > statsIndex && mapIndex > mascotIndex);
  assert.match(css, /#top\s*\{\s*border-bottom:\s*0\s*!important/);
  assert.match(css, /\.trust-strip\s*\{[\s\S]*?order:\s*2;[\s\S]*?margin-top:\s*0;[\s\S]*?background:\s*transparent;/);
  assert.match(css, /@media \(max-width:\s*1023px\)[\s\S]*?\.trust-strip\s*\{[^}]*margin-top:\s*0;/);
  assert.match(css, /\.trust-stat strong\s*\{[\s\S]*?font-size:\s*30px;[\s\S]*?font-weight:\s*900;/);
});

test("버들이와 둥근 안내 상자를 참고 이미지 위치로 표시한다", async () => {
  const response = await render();
  const html = await response.text();
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");

  assert.match(html, /예요!<\/span><br>/);
  assert.match(html, /동네 마실<br>나가볼까요/);
  assert.match(css, /\[data-r="hero-mascot"\]\s*\{[\s\S]*?position:\s*relative\s*!important;[\s\S]*?order:\s*1;[\s\S]*?align-self:\s*center;[\s\S]*?margin:\s*80px auto 0;/);
  assert.match(css, /\[data-r="hero-mascot"\]\s*>\s*div\s*\{[\s\S]*?width:\s*230px;[\s\S]*?border-radius:\s*20px\s*!important;[\s\S]*?font-size:\s*15px\s*!important;/);
  assert.match(css, /\[data-r="hero-mascot"\]\s*>\s*img\s*\{[\s\S]*?align-self:\s*center;[\s\S]*?margin-left:\s*0;/);
  assert.match(css, /\[data-r="hero-mascot"\]\s*>\s*div::after\s*\{\s*display:\s*none;/);
});

test("네 걸음 안내 제목 왼쪽에 새 버들이를 상단 캐릭터 크기로 표시한다", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");

  assert.match(css, /\[data-r="four-step-heading"\]\s*>\s*img\s*\{[\s\S]*?width:\s*120px;[\s\S]*?height:\s*141px;/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*?\[data-r="four-step-heading"\]\s*>\s*img\s*\{[\s\S]*?width:\s*96px;[\s\S]*?height:\s*113px;/);
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

test("원안 하단의 법적 고지는 실제 정책 페이지로 연결된다", async () => {
  const response = await render();
  const html = await response.text();

  for (const [label, href] of [
    ["이용약관", "/terms"],
    ["개인정보처리방침", "/privacy"],
    ["위치기반서비스 이용약관", "/location-terms"],
    ["공공데이터 이용정책", "/public-data"],
    ["계정·데이터 삭제", "/account-deletion"],
  ]) {
    assert.match(html, new RegExp(`href="${href}"[^>]*>${label}`));
  }
});

test("법적 고지 페이지 5개를 독립 경로로 제공한다", async () => {
  const pages = [
    ["/terms", /동네고고 이용약관/, /서비스가 동작하는 방식/],
    ["/privacy", /개인정보처리방침/, /소셜 로그인 데이터 흐름/],
    ["/location-terms", /위치기반서비스 이용약관/, /사용자 위치 기반 데이터 흐름/],
    ["/public-data", /공공데이터·공공누리 이용정책/, /공공누리 공식 마크와 1~4유형/],
    ["/account-deletion", /계정·데이터 삭제/, /계정 삭제 처리 흐름/],
  ];

  for (const [pathname, title, detail] of pages) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, title);
    assert.match(html, detail);
    assert.doesNotMatch(html, /jupwdcfkybvyrrmzmwed|ccbhczlrhlbtyszubgxr|sb_secret_|service_role/i);
  }
});

test("공공데이터 정책은 공공누리 공식 마크와 확인된 출처 조건만 표시한다", async () => {
  const response = await render("/public-data");
  const html = await response.text();

  for (const type of [1, 2, 3, 4]) {
    assert.match(html, new RegExp(`/legal/kogl/number${type}\\.jpg`));
    assert.match(html, new RegExp(`공공누리 제${type}유형`));
  }
  assert.match(html, /https:\/\/www\.kogl\.or\.kr\/info\/license\.do/);
  assert.match(html, /기관명, 작성연도, 저작물명, 작성자명/);
  assert.match(html, /이용허락범위 제한 없음/);
  assert.match(html, /공공누리 제1유형으로 바꿔 표시하지 않습니다/);
  assert.match(html, /유형이 확인되지 않은 자료에는 공공누리 마크를 붙이지 않습니다/);
  assert.match(html, /제3자 권리/);
  assert.match(html, /Kakao·Naver·Apple/);
});

test("운영자 정보는 반영하고 주거 주소는 위치약관에만 제한한다", async () => {
  const address = /서울시(?:<!-- -->)? 북악산로(?:<!-- -->)? 851,(?:<!-- -->)? 101동(?:<!-- -->)? 603호/;

  for (const pathname of ["/terms", "/privacy", "/public-data", "/account-deletion"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /포레스트 이음/);
    assert.match(html, /689-01-03864/);
    assert.doesNotMatch(html, address, pathname);
  }

  const locationResponse = await render("/location-terms");
  const locationHtml = await locationResponse.text();
  assert.match(locationHtml, address);
  assert.match(locationHtml, /위치정보관리책임자/);
  assert.match(locationHtml, /조재완/);
});

test("공공누리 1~4유형과 출처 표시 원칙을 모두 고지한다", async () => {
  const response = await render("/public-data");
  const html = await response.text();

  for (const type of [1, 2, 3, 4]) {
    assert.match(html, new RegExp(`공공누리 제(?:<!-- -->)?${type}(?:<!-- -->)?유형`));
  }
  assert.match(html, /출처·저작권 표시 방식/);
  assert.match(html, /라이선스 미확인/);
  assert.match(html, /숙박 자원은 수집·제공 대상에서 제외/);
});
