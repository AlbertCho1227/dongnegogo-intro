import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname, accept = "text/html") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("blog-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`https://www.dongnegogo.com${pathname}`, { headers: { accept } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    DONGNEGOGO_SUPABASE_URL: process.env.DONGNEGOGO_SUPABASE_URL,
    DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY: process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("홈 상단과 하단에서 공개 블로그로 이동할 수 있다", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /data-r="blog-link"[^>]*href="\/blog"/);
  assert.ok((html.match(/href="\/blog"/g) ?? []).length >= 2);
});

test("블로그는 세 개의 원본 글과 검색·카테고리 탐색을 제공한다", async () => {
  const response = await render("/blog");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /오늘의 동네를/);
  assert.match(html, /지금 읽기 좋은 동네 이야기/);
  assert.match(html, /블로그 검색/);
  assert.match(html, /인천 부평 무료 어린이 AI 코딩 강좌/);
  assert.match(html, /청주 무료 그림책 전시/);
  assert.match(html, /충무스포츠센터 접수 전 확인할 6가지/);
  assert.match(html, /복사하지 않고,[\s\S]*확인하고 씁니다/);
  assert.match(html, /"@type":"Blog"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
});

test("각 글은 고유 메타데이터·출처·구조화 데이터·내부 링크를 갖는다", async () => {
  const slugs = [
    "bupyeong-free-kids-ai-coding-class",
    "cheongju-picture-book-garden-exhibition-guide",
    "seoul-junggu-chungmu-swimming-pool-checklist",
  ];
  for (const slug of slugs) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /동네고고 편집팀/);
    assert.match(html, /프로그램 한눈에 보기/);
    assert.match(html, /공식 안내 확인/);
    assert.match(html, /지도에서 주변 찾기/);
    assert.match(html, /정보 출처/);
    assert.match(html, /원문을 복제하지 않았습니다/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"datePublished":"2026-08-22T/);
    assert.match(html, new RegExp(`rel="canonical" href="https://www\\.dongnegogo\\.com/blog/${slug}"`));
  }
});

test("RSS는 전체 본문을, 사이트맵은 블로그 URL을 제공한다", async () => {
  const rssResponse = await render("/blog/rss.xml", "application/rss+xml");
  const rss = await rssResponse.text();
  assert.equal(rssResponse.status, 200);
  assert.match(rssResponse.headers.get("content-type") ?? "", /application\/rss\+xml/);
  assert.equal((rss.match(/<item>/g) ?? []).length, 3);
  assert.match(rss, /content:encoded/);
  assert.match(rss, /이 강좌가 첫 코딩에 잘 맞는 이유/);
  assert.match(rss, /그림책 전시는 어떻게 보면 좋을까요/);
  assert.match(rss, /등록 전에 꼭 비교할 여섯 가지/);

  const sitemapResponse = await render("/sitemap.xml", "application/xml");
  const sitemap = await sitemapResponse.text();
  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemap, /https:\/\/www\.dongnegogo\.com\/blog<\/loc>/);
  for (const slug of ["bupyeong-free-kids-ai-coding-class", "cheongju-picture-book-garden-exhibition-guide", "seoul-junggu-chungmu-swimming-pool-checklist"]) {
    assert.match(sitemap, new RegExp(`https://www\\.dongnegogo\\.com/blog/${slug}`));
  }
});

test("검색 공유 이미지는 프로젝트에 포함되고 외부 사진을 쓰지 않는다", async () => {
  const image = await readFile(new URL("public/blog/og.png", projectRoot));
  const data = await readFile(new URL("lib/blog-posts.ts", projectRoot), "utf8");
  assert.ok(image.byteLength > 100_000);
  assert.match(data, /\/markers\/icon_digital\.png/);
  assert.match(data, /\/markers\/icon_exhibition\.png/);
  assert.match(data, /\/markers\/icon_swimming\.png/);
  assert.doesNotMatch(data, /primary_image_url|program-posters|culture\.go\.kr|yeyak\.seoul\.go\.kr\/web\/common\/file/);
});

test("접근 보호가 있는 서울시·공유누리 링크는 상세 주소를 우회하지 않고 공식 홈 검색으로 안내한다", async () => {
  const access = await readFile(new URL("lib/official-program-access.ts", projectRoot), "utf8");
  const article = await readFile(new URL("app/blog/program/[id]/page.tsx", projectRoot), "utf8");
  const map = await readFile(new URL("app/web/web-map-app.tsx", projectRoot), "utf8");

  assert.match(access, /SEOUL_RESERVATION_HOST = "yeyak\.seoul\.go\.kr"/);
  assert.match(access, /SEOUL_RESERVATION_HOME = `https:\/\/\$\{SEOUL_RESERVATION_HOST\}\//);
  assert.match(access, /ESHARE_HOSTS = new Set\(\["eshare\.go\.kr", "www\.eshare\.go\.kr"\]\)/);
  assert.match(access, /ESHARE_HOME = "https:\/\/www\.eshare\.go\.kr\/"/);
  assert.match(access, /requiresHomepageSearch: true/);
  assert.match(article, /상세 주소로 바로 이동하지 않습니다/);
  assert.match(article, /접근 제한 화면이 보이면 반복해서 누르지 말고/);
  assert.match(article, /rel="external nofollow noopener noreferrer"/);
  assert.match(article, /referrerPolicy="no-referrer"/);
  assert.match(map, /\$\{officialAccess\.providerName\} 홈에서 검색/);
  assert.doesNotMatch(article, /href=\{program\.applyUrl\}/);
  assert.doesNotMatch(map, /className="dg-apply" href=\{program\.applyUrl\}/);
});

test("프로그램 대표 사진은 중앙 오버레이 없이 작은 카테고리 배지만 표시한다", async () => {
  const article = await readFile(new URL("app/blog/program/[id]/page.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  const heroStart = article.indexOf('<div className="blog-article__visual blog-program-hero-media">');
  const heroEnd = article.indexOf("</div>", heroStart);
  const hero = article.slice(heroStart, heroEnd);
  assert.ok(heroStart >= 0);
  assert.doesNotMatch(hero, /blog-program-media-fallback|blog-marker-image/);
  assert.match(hero, /images\[0\] && <ProgramMediaImage/);
  assert.match(hero, /className="blog-marker-badge"/);
  assert.match(styles, /\.blog-program-hero-media > img\.is-media-fallback:not\(\.blog-marker-badge\) \{ opacity: 0; \}/);
});

test("시설 사진이 한 장이면 제목과 같은 본문 기준선에 맞춘다", async () => {
  const article = await readFile(new URL("app/blog/program/[id]/page.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  assert.match(article, /images\.length === 2 \? " blog-media-grid--single"/);
  assert.match(styles, /\.blog-media-grid--single \{ width: 100%; max-width: 760px; margin-inline: auto; grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("전국 프로그램 글은 120개 고정 목록이 아니라 서버 페이지·카테고리 검색으로 탐색한다", async () => {
  const page = await readFile(new URL("app/blog/page.tsx", projectRoot), "utf8");
  const data = await readFile(new URL("lib/blog-program-data.ts", projectRoot), "utf8");
  const explorer = await readFile(new URL("components/program-story-explorer.tsx", projectRoot), "utf8");

  assert.doesNotMatch(page, /slice\(0, 120\)|getBlogProgramCategoryPage\("교육", 44\)/);
  assert.match(page, /getBlogProgramArchivePage/);
  assert.match(data, /BLOG_ARCHIVE_PAGE_SIZE = 48/);
  assert.match(data, /"교육·강좌": \{ categories: \["교육"\] \}/);
  assert.match(data, /"취미·체험": \{ categories: \["교육", "문화", "문화행사"\]/);
  assert.match(data, /params\.append\("name", "not\.ilike\.\*주차장\*"\)/);
  assert.match(explorer, /className="blog-pagination"/);
  assert.match(explorer, /전체 \{total\.toLocaleString\("ko-KR"\)\}개 중/);
});

test("교육·강좌와 취미·체험 보관함은 Supabase 전체 결과를 서버에서 나눠 보여준다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  for (const category of ["교육·강좌", "취미·체험"]) {
    const response = await render(`/blog?category=${encodeURIComponent(category)}`);
    const html = await response.text();
    const plainText = html.replace(/<!--[\s\S]*?-->|<[^>]+>/g, "");
    const count = plainText.match(/전체 ([\d,]+)개 중/)?.[1];
    assert.equal(response.status, 200);
    assert.ok(count && Number(count.replaceAll(",", "")) > 120);
    assert.match(html, /aria-label="프로그램 글 페이지"/);
    assert.match(html, new RegExp(`${category}[^<]*<\\/a>`));
  }
});

test("서울시 예약 프로그램 글은 첫 클릭에 내부 확인 방법을 열고 상세 예약 주소를 노출하지 않는다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const id = encodeURIComponent("program:reservations:a8e9888b02694976");
  const response = await render(`/blog/program/${id}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  const plainHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(plainHtml, /서울시 공공서비스예약 공식 확인 방법 보기/);
  assert.match(html, /href="https:\/\/yeyak\.seoul\.go\.kr\/"/);
  assert.doesNotMatch(html, /selectReservView\.do|rsv_svc_id=/);
});

test("공유누리 차단 상세 링크는 홈 검색으로 바꾸고 정상 운영기관 링크는 직접 연결을 유지한다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const protectedResponse = await render(`/blog/program/${encodeURIComponent("program:eshare:08ebf85c71574867")}`);
  const protectedHtml = await protectedResponse.text();
  assert.equal(protectedResponse.status, 200);
  const protectedPlainHtml = protectedHtml.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(protectedPlainHtml, /공유누리 공식 확인 방법 보기/);
  assert.match(protectedHtml, /href="https:\/\/www\.eshare\.go\.kr\/"/);
  assert.doesNotMatch(protectedHtml, /UprResrcFacl|rsrc_no=/);

  const directResponse = await render(`/blog/program/${encodeURIComponent("program:eshare:e241ea2d80de17ae")}`);
  const directHtml = await directResponse.text();
  assert.equal(directResponse.status, 200);
  assert.match(directHtml, /href="https:\/\/snymca\.org\/"/);
  assert.match(directHtml, /공식 신청·안내 확인/);
  const directPlainHtml = directHtml.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(directPlainHtml, /공유누리 공식 확인 방법 보기/);
});

test("실제 프로그램 글은 포스터·시설 사진 출처, 영구 보존 안내, AEO 스키마를 제공한다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const id = encodeURIComponent("program:cultural_events:ae75ebe1c65f09cf");
  const response = await render(`/blog/program/${id}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /포스터와 시설 사진으로 미리 보기/);
  assert.match(html, /사진 출처:/);
  assert.match(html, /기간이 끝나면 이 글도 삭제되나요/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"@type":"Event"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /rel="canonical" href="https:\/\/www\.dongnegogo\.com\/blog\/program\//);
});

test("분할 프로그램 사이트맵은 주차장을 제외하고 색인 가능한 글만 싣는다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const response = await render("/blog/sitemaps/programs/1", "application/xml");
  const xml = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/xml/);
  assert.ok((xml.match(/<url>/g) ?? []).length > 100);
  assert.doesNotMatch(xml, /주차장|parking/i);
  assert.match(xml, /\/blog\/program\/program%3A/);
});
