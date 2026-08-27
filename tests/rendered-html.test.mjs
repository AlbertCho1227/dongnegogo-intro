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

async function render(pathname = "/", origin = "http://localhost") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`${origin}${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("운영 응답에 브라우저 보안 경계를 강제한다", async () => {
  const response = await render("/", "https://www.dongnegogo.com");
  const csp = response.headers.get("content-security-policy") ?? "";

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /https:\/\/dapi\.kakao\.com/);
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
  assert.equal(response.headers.get("origin-agent-cluster"), "?1");
  assert.equal(response.headers.get("x-permitted-cross-domain-policies"), "none");
  assert.match(response.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  assert.match(response.headers.get("permissions-policy") ?? "", /geolocation=\(self\)/);
  assert.match(response.headers.get("permissions-policy") ?? "", /microphone=\(self\)/);
});

test("평문 개발 응답에는 HSTS를 잘못 부착하지 않는다", async () => {
  const response = await render();
  assert.equal(response.headers.get("strict-transport-security"), null);
});

test("동네고고 서비스 소개 홈페이지를 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<meta name="google-site-verification" content="cjeYGg8Z11C59idKYE91ALiCdAhslfunVNBv3XLx3ac"\/>/);
  assert.match(html, /<meta name="naver-site-verification" content="645fbd3189250f6faed6a20e675b4a23b113c02b"\/>/);
  assert.match(html, /<title>동네고고 \| 우리 동네 교육·문화·체육·행사 한눈에<\/title>/);
  assert.match(html, /<meta name="description" content="내 주변의 교육, 문화, 체육, 공연, 전시와 공공 프로그램을 지도에서 쉽고 빠르게 찾아보세요\."\/>/);
  assert.match(html, /data-r="hero-title"[\s\S]*?우리 주변의 배움(?:&nbsp;|&#xA0;|\s)+과(?:&nbsp;|&#xA0;|\s)+[\s\S]*?data-r="mobile-break"[\s\S]*?즐거움을 한눈에[\s\S]*?동네고고 하나로/);
  assert.match(html, /data-r="map-heading"[\s\S]*?강좌와 행사가 지도 위에[\s\S]*?data-r="mobile-break"[\s\S]*?아이콘으로 떠 있어요/);
  assert.match(html, /신청까지 네 걸음이면[\s\S]*?data-r="mobile-break"[\s\S]*?충분해요/);
  assert.match(html, /data-r="four-step-heading"/);
  assert.match(html, /assets\/beodeuli-search\.png/);
  assert.match(html, /AI 쉬운 설명/);
  assert.match(html, /오픈런 알림/);
  assert.match(html, /가족 도우미 모드/);
  assert.match(html, /신청하러 가기/);
  assert.doesNotMatch(html, />바로 신청하기<|>지금 바로 신청하기</);
  assert.match(html, /41,723/);
  assert.match(html, /16,957/);
  assert.match(html, /2,496/);
  assert.match(html, /14,255/);
  assert.match(html, /9,461/);
  assert.match(html, /2026년 8월 20일(?:<!-- -->)? 기준/);
  assert.match(html, /프로그램·문화공간·체육시설 포함/);
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
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(html, /uploads\/B93E5F67-2560-45D3-A5A5-08A0A8E75E1B\.png/);
  assert.match(html, /uploads\/Screenshot 2026-08-11 at 3\.35\.17 PM\.png/);
  assert.match(html, /uploads\/b24d3c0f-525c-43b8-b8fc-27b46f137b6f\.png/);
  assert.match(html, /uploads\/program-detail-summer-mediawall\.png/);
  assert.match(html, /uploads\/program-detail-summer-poster\.png/);
  assert.match(html, /2026 동네고고 미디어아트 전시 여름빛 미디어월 프로그램 상세 화면/);
  assert.match(html, /data-r="program-detail-phone"/);
  assert.match(html, /data-r="program-detail-screen"/);
  assert.match(html, /data-r="program-detail-poster-inset"/);
  assert.match(html, /assets\/beodeuli-wave\.png/);
  assert.equal((html.match(/data-r="screenshot-apply-cta"/g) ?? []).length, 5);
  assert.match(css, /\[data-r="screenshot-apply-cta"\]::after\s*\{[\s\S]*?content:\s*"신청하러 가기"/);
  assert.match(css, /\[data-r="program-detail-phone"\]\s*\{[\s\S]*?width:\s*200px\s*!important;[\s\S]*?padding:\s*5px 5px 0\s*!important;/);
  assert.match(css, /\[data-r="program-detail-poster-inset"\]\s*\{[\s\S]*?inset:\s*33\.82% 0 0;[\s\S]*?padding:\s*4px 10px 3px;/);
  assert.match(css, /\[data-r="program-detail-poster-inset"\]\s*>\s*img\s*\{[\s\S]*?object-fit:\s*contain;/);
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
  assert.match(html, /data-r="app-release-note">애플 &amp; 안드로이드 앱이 곧 출시될 예정이에요<\/p>/);
  assert.match(css, /\[data-r="header-actions"\] \{[\s\S]*?border: 2px solid #2fa84f;[\s\S]*?border-radius: 20px;[\s\S]*?display: grid !important;/);
  assert.match(css, /\[data-r="app-release-note"\] \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?text-align: center;/);
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

test("통계 모듈은 서버 전용 native fetch와 짧은 검증 캐시만 사용한다", async () => {
  const source = await readFile(new URL("lib/program-stats.ts", projectRoot), "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /DONGNEGOGO_SUPABASE_URL/);
  assert.match(source, /DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source, /startsWith\("sb_publishable_"\)/);
  assert.match(source, /get_public_program_stats_v1/);
  assert.match(source, /unstable_cache/);
  assert.match(source, /CACHE_SECONDS = 900/);
  assert.match(source, /FALLBACK_RETRY_SECONDS = 300/);
  assert.match(source, /REQUEST_TIMEOUT_MS = 2_000/);
  assert.match(source, /await fetch\(/);
  assert.doesNotMatch(source, /@supabase\/supabase-js|createClient|NEXT_PUBLIC_/);
});

test("프로그램 공유 페이지는 서버 전용 공개 데이터와 스크롤형 카드 템플릿을 사용한다", async () => {
  const page = await readFile(new URL("app/program/[id]/page.tsx", projectRoot), "utf8");
  const shareImage = await readFile(new URL("app/program/[id]/opengraph-image.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/program/[id]/program-share.module.css", projectRoot), "utf8");
  const data = await readFile(new URL("lib/program-share-data.ts", projectRoot), "utf8");
  const mapIcons = await readFile(new URL("lib/official-map-icons.ts", projectRoot), "utf8");
  const openApp = await readFile(new URL("app/program/[id]/OpenAppButton.tsx", projectRoot), "utf8");
  const webMap = await readFile(new URL("app/web/web-map-app.tsx", projectRoot), "utf8");

  assert.match(page, /동네고고에서 찾았어요/);
  assert.match(page, /if \(trimmed\.includes\(":"\)\) return trimmed/);
  assert.match(page, /decodeURIComponent\(trimmed\)/);
  assert.match(page, /이 프로그램은요/);
  assert.match(page, /알림을 켜두면 놓치지 않아요/);
  assert.match(page, /지도에서 더 자세히 보기/);
  assert.match(page, /카카오 지도/);
  assert.match(page, /네이버 지도/);
  assert.match(page, /구글 지도/);
  assert.match(page, /OFFICIAL_MAP_ICONS\.kakao\.publicPath/);
  assert.match(page, /OFFICIAL_MAP_ICONS\.naver\.publicPath/);
  assert.match(page, /OFFICIAL_MAP_ICONS\.google\.publicPath/);
  assert.match(page, /program\.images\.map/);
  assert.match(page, /\[동네고고\] - \$\{program\.name\}/);
  assert.doesNotMatch(page, /openGraph:[\s\S]*images:\s*image/);
  assert.match(shareImage, /ImageResponse/);
  assert.match(shareImage, /동네고고에서 찾았어요/);
  assert.match(shareImage, /이 프로그램은요/);
  assert.match(shareImage, /알림을 켜두면 놓치지 않아요/);
  assert.match(shareImage, /‘동네고고’ 앱 이동은 여기서/);
  assert.match(shareImage, /지도 바로가기/);
  assert.match(shareImage, /카카오 지도/);
  assert.match(shareImage, /네이버 지도/);
  assert.match(shareImage, /구글 지도/);
  assert.match(shareImage, /OFFICIAL_MAP_ICONS\.kakao\.dataURL/);
  assert.match(shareImage, /OFFICIAL_MAP_ICONS\.naver\.dataURL/);
  assert.match(shareImage, /OFFICIAL_MAP_ICONS\.google\.dataURL/);
  assert.match(shareImage, /max-age=300/);
  assert.match(mapIcons, /https:\/\/map\.kakao\.com\/favicon\.ico/);
  assert.match(mapIcons, /https:\/\/ssl\.pstatic\.net\/static\/maps\/assets\/icons\/favicon\.ico/);
  assert.match(mapIcons, /https:\/\/www\.google\.com\/images\/branding\/product\/ico\/web_maps_icon_32dp\.ico/);
  assert.match(styles, /background:\s*#f7f4e9/);
  assert.match(styles, /background:\s*#087a42/);
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /width:\s*min\(100%, 390px\)/);
  assert.match(data, /import "server-only"/);
  assert.match(data, /program_media_public/);
  assert.match(data, /program_facility_media/);
  assert.match(data, /rights_verified/);
  assert.match(data, /image_sha256/);
  assert.match(data, /imageContentIdentity/);
  assert.match(data, /program-share-v3-source-alias-dedup/);
  assert.match(data, /get_programs_by_map_cluster_ids/);
  assert.match(data, /JSON\.stringify\(\{ p_ids: \[programID\] \}\)/);
  assert.match(data, /DONGNEGOGO_SUPABASE_URL/);
  assert.match(data, /DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(data, /startsWith\("sb_publishable_"\)/);
  assert.doesNotMatch(data, /service_role|sb_secret_|NEXT_PUBLIC_/i);
  assert.match(openApp, /href=\{`\/web\?program=\$\{encodeURIComponent\(programID\)\}`\}/);
  assert.doesNotMatch(openApp, /dongnegogo:\/\/|window\.setTimeout/);
  assert.match(webMap, /new URLSearchParams\(window\.location\.search\)\.get\("program"\)/);
  assert.match(webMap, /fetchPrograms\(new URLSearchParams\(\{ id: programID \}\)/);
  assert.match(webMap, /void selectProgram\(program\)/);
});

test("웹 버전은 Kakao SDK와 공개키 기반 Supabase 계정 동기화만 브라우저에 포함한다", async () => {
  const clientArtifacts = (await collectTextArtifacts(new URL("dist/client/", projectRoot))).join("\n");
  assert.match(clientArtifacts, /dapi\.kakao\.com\/v2\/maps\/sdk\.js/);
  assert.match(clientArtifacts, /NEXT_PUBLIC_SUPABASE/);
  assert.match(clientArtifacts, /sb_publishable_/);
  assert.doesNotMatch(
    clientArtifacts,
    /support\.js|DCLogic|<x-dc/i,
  );
});

test("운영 소개 페이지에서는 웹 버전 버튼을 숨기고 독립 지도 화면은 유지한다", async () => {
  const home = await render();
  const homeHtml = await home.text();
  assert.doesNotMatch(homeHtml, /data-r="web-version-link"|>웹 버전<\/a>/);

  const homeSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(homeSource, /process\.env\.NODE_ENV === "development"/);
  assert.match(homeSource, /SHOW_LOCAL_WEB_VERSION_LINK \? HEADER_ACTIONS_WITH_WEB : HEADER_ACTIONS_WITHOUT_WEB/);

  const web = await render("/web");
  assert.equal(web.status, 200);
  const webHtml = await web.text();
  assert.match(webHtml, /웹 버전 \| 동네고고/);
  assert.match(webHtml, /프로그램 탐색 패널/);
  assert.match(webHtml, /Kakao 지도/);
});

test("웹 프로그램 API는 공개 SELECT와 읽기 전용 RPC만 사용하며 DB 쓰기 동작을 포함하지 않는다", async () => {
  const data = await readFile(new URL("lib/web-program-data.ts", projectRoot), "utf8");
  const route = await readFile(new URL("app/api/web-programs/route.ts", projectRoot), "utf8");
  assert.match(data, /method:\s*"GET"/);
  assert.match(data, /\/rest\/v1\/programs/);
  assert.match(data, /sb_publishable_/);
  assert.match(data, /get_program_map_viewport_v4/);
  assert.match(data, /search_program_candidates_v2/);
  assert.match(data, /search_program_place_suggestions_v1/);
  assert.match(data, /get_programs_near/);
  const rpcNames = [...data.matchAll(/rpc\("([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(rpcNames.sort(), [
    "get_heat_shelters_in_bounds",
    "get_open_run_programs_v1",
    "get_program_map_filter_catalog_v3",
    "get_program_map_viewport_v4",
    "get_programs_by_map_cluster_ids",
    "get_programs_near",
    "nearby_places_summary_v2",
    "search_program_candidates_v2",
    "search_program_place_suggestions_v1",
  ]);
  assert.doesNotMatch(`${data}\n${route}`, /service_role|sb_secret_|method:\s*"(?:PUT|PATCH|DELETE)"|\.insert\(|\.update\(|\.upsert\(|\.delete\(/i);
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

test("신규 계정 삭제는 즉시 파기되고 30일 복구를 제공하지 않는다", async () => {
  const deletionResponse = await render("/account-deletion");
  const deletionHtml = await deletionResponse.text();
  assert.match(deletionHtml, /즉시 파기/);
  assert.match(deletionHtml, /30일 복구·유예 기간은 운영하지 않습니다/);
  assert.match(deletionHtml, /모든 이용자 계정·인증·작성 콘텐츠를 제거/);
  assert.match(deletionHtml, /같은 동네고고 사용자 UUID/);
  assert.match(deletionHtml, /다른 기기에서 삭제되었다는 안내/);
  assert.match(deletionHtml, /백그라운드에 있거나 오프라인인 기기/);
  assert.match(deletionHtml, /앱을 다시 열거나 네트워크가 연결되는 즉시/);
  assert.doesNotMatch(deletionHtml, /30일 안에 다시 로그인하면 되돌릴 수/);
  assert.doesNotMatch(deletionHtml, /모든 기기[^.]*즉시 로그아웃/);

  const privacyResponse = await render("/privacy");
  const privacyHtml = await privacyResponse.text();
  assert.match(privacyHtml, /삭제를 요청한 기기의 계정 관련 로컬 저장값과 캐시도 함께 삭제/);
  assert.match(privacyHtml, /다른 iOS·Android·앱인토스 기기/);
  assert.match(privacyHtml, /다음 실행·활성화·네트워크 연결 시 처리/);
  assert.match(privacyHtml, /최대 7일/);
  assert.match(privacyHtml, /삭제 전 백업은 운영 서비스에 그대로 복원하지 않/);

  const termsResponse = await render("/terms");
  const termsHtml = await termsResponse.text();
  assert.match(termsHtml, /같은 동네고고 계정의 서버 세션은 함께 종료/);
  assert.match(termsHtml, /종료·백그라운드·오프라인 기기/);
});

test("가입·로그인 시 중복 계정을 확인하고 최신 세션만 유지한다고 고지한다", async () => {
  const privacyResponse = await render("/privacy");
  const privacyHtml = await privacyResponse.text();
  assert.match(privacyHtml, /가입·로그인 과정에서는 인증 제공자 식별자의 고유성/);
  assert.match(privacyHtml, /서로 다른 사용자 UUID에 같은 확인 이메일/);
  assert.match(privacyHtml, /가장 최근 로그인을 제외한 기존 서버 세션을 종료/);
  assert.match(privacyHtml, /한 번에 하나의 최신 서버 세션만 유지/);

  const termsResponse = await render("/terms");
  const termsHtml = await termsResponse.text();
  assert.match(termsHtml, /가입·로그인 시 제공자 식별자/);
  assert.match(termsHtml, /가장 최근에 완료된 로그인 한 건만 유지/);
  assert.match(termsHtml, /이전 기기에는 자동 로그아웃 안내/);
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

test("운영자 정보는 반영하고 사업장 주소는 위치약관에만 제한한다", async () => {
  const address = /서울시(?:<!-- -->)? 강남구(?:<!-- -->)? 테헤란로79길(?:<!-- -->)? 6(?:<!-- -->)? JS타워(?:<!-- -->)? 3층(?:<!-- -->)? 브이1462/;
  const oldAddress = /서울시(?:<!-- -->)? 북악산로(?:<!-- -->)? 851,(?:<!-- -->)? 101동(?:<!-- -->)? 603호/;

  for (const pathname of ["/terms", "/privacy", "/public-data", "/account-deletion"]) {
    const response = await render(pathname);
    const html = await response.text();
    assert.match(html, /포레스트 이음/);
    assert.match(html, /689-01-03864/);
    assert.doesNotMatch(html, address, pathname);
    assert.doesNotMatch(html, oldAddress, pathname);
    assert.doesNotMatch(html, /조재완/, pathname);
  }

  const locationResponse = await render("/location-terms");
  const locationHtml = await locationResponse.text();
  assert.match(locationHtml, address);
  assert.doesNotMatch(locationHtml, oldAddress);
  assert.match(locationHtml, /위치정보관리책임자/);
  assert.match(locationHtml, /정재은/);
  assert.match(locationHtml, /070-8098-7879/);
  assert.doesNotMatch(locationHtml, /조재완/);
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
