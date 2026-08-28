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
  assert.ok(html.indexOf('data-r="blog-link"') < html.indexOf('href="#map"'), "블로그 메뉴가 지도 탐색 왼쪽에 있어야 합니다.");
  assert.ok((html.match(/href="\/blog"/g) ?? []).length >= 2);
});

test("블로그 전체 페이지에 초록색 위로 가기 버튼과 스크롤 기능을 제공한다", async () => {
  const layout = await readFile(new URL("app/blog/layout.tsx", projectRoot), "utf8");
  const button = await readFile(new URL("components/blog-scroll-to-top.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  assert.match(layout, /<BlogScrollToTop \/>/);
  assert.match(button, /window\.scrollY >= SHOW_AFTER_PX/);
  assert.match(button, /window\.scrollTo\(\{ top: 0, behavior:/);
  assert.match(button, /prefers-reduced-motion: reduce/);
  assert.match(button, /aria-label="페이지 맨 위로 이동"/);
  assert.match(styles, /\.blog-scroll-top \{[^}]*position: fixed;[^}]*border-radius: 50%;[^}]*background: #238e4d;/);
  assert.match(styles, /\.blog-scroll-top\.is-visible \{[^}]*opacity: 1;[^}]*pointer-events: auto;/);
});

test("블로그는 편집 추천과 전국 프로그램 검색·카테고리 탐색을 제공한다", async () => {
  const response = await render("/blog");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /오늘의 동네를/);
  assert.match(html, /가장 최근 업데이트된 이야기/);
  assert.match(html, /프로그램 글 검색/);
  assert.match(html, /인천 부평 무료 어린이 AI 코딩 강좌/);
  assert.match(html, /복사하지 않고,[\s\S]*확인하고 씁니다/);
  assert.match(html, /"@type":"Blog"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
});

test("상단 최신 이야기에는 Supabase 업데이트 순서의 3개만 표시하고 중복 필터 영역은 두지 않는다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const response = await render("/blog");
  const html = await response.text();
  const plainHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const explorer = await readFile(new URL("components/blog-explorer.tsx", projectRoot), "utf8");
  const data = await readFile(new URL("lib/blog-program-data.ts", projectRoot), "utf8");

  assert.equal(response.status, 200);
  assert.equal((html.match(/class="blog-card blog-accent--/g) ?? []).length, 3);
  assert.match(plainHtml, /가장 최근 업데이트된 3개의 이야기예요/);
  assert.doesNotMatch(explorer, /className="blog-tools"|카테고리 필터|블로그 검색/);
  assert.match(data, /getLatestBlogPrograms/);
  assert.match(data, /cachedArchiveRows\(0, safeLimit, "전체", "", "전체"\)/);
  assert.match(data, /order: "updated_at\.desc\.nullslast,id\.asc"/);
});

test("편집 추천과 최신 이야기 카드가 실제 프로그램 이미지를 우선 표시한다", async () => {
  const page = await readFile(new URL("app/blog/page.tsx", projectRoot), "utf8");
  const explorer = await readFile(new URL("components/blog-explorer.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  assert.match(page, /featured\.imageUrl[\s\S]*?<ProgramMediaImage className="blog-featured__image"/);
  assert.match(explorer, /program\.imageUrl[\s\S]*?<ProgramMediaImage className="blog-card__image"/);
  assert.match(styles, /> img\.blog-featured__image \{[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: cover;/);
  assert.match(styles, /> img\.blog-card__image \{[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: cover;/);
  assert.match(styles, /img\.blog-featured__image\.is-media-fallback/);
  assert.match(styles, /img\.blog-card__image\.is-media-fallback/);
});

test("각 글은 고유 메타데이터·출처·구조화 데이터·내부 링크를 갖는다", async () => {
  const slugs = [
    "bupyeong-free-kids-ai-coding-class",
    "cheongju-picture-book-garden-exhibition-guide",
    "seoul-junggu-chungmu-swimming-pool-checklist",
    "seoul-guro-free-parent-growth-class",
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
    assert.match(html, /"datePublished":"2026-08-2[23]T/);
    assert.match(html, new RegExp(`rel="canonical" href="https://www\\.dongnegogo\\.com/blog/${slug}"`));
  }
});

test("RSS는 전체 본문을, 사이트맵은 블로그 URL을 제공한다", async () => {
  const rssResponse = await render("/blog/rss.xml", "application/rss+xml");
  const rss = await rssResponse.text();
  assert.equal(rssResponse.status, 200);
  assert.match(rssResponse.headers.get("content-type") ?? "", /application\/rss\+xml/);
  assert.equal((rss.match(/<item>/g) ?? []).length, 34);
  assert.match(rss, /content:encoded/);
  assert.match(rss, /이 강좌가 첫 코딩에 잘 맞는 이유/);
  assert.match(rss, /그림책 전시는 어떻게 보면 좋을까요/);
  assert.match(rss, /등록 전에 꼭 비교할 여섯 가지/);
  assert.match(rss, /부모 역할을 ‘리모델링’한다는 뜻/);
  assert.match(rss, /첫 가족 뮤지컬은 이야기보다 회차가 중요해요/);
  assert.match(rss, /현대무용을 처음 볼 때 좋은 관람 기준/);
  assert.match(rss, /여러 주 과정은 회차 구성을 먼저 보세요/);
  assert.match(rss, /하모니카 오케스트라는 무엇을 들으면 좋을까요/);
  assert.match(rss, /제목을 관람 질문으로 바꿔 보세요/);
  assert.match(rss, /6인 예약석 결제 전 체크리스트/);
  assert.match(rss, /관찰 수업은 결과보다 기록 방법이 중요해요/);
  assert.match(rss, /가곡 합창은 가사와 화음의 거리를 함께 들어보세요/);
  assert.match(rss, /워크숍 묶음은 ‘내가 가능한 한 회차’부터 고르세요/);
  assert.match(rss, /직업체험은 결과보다 질문을 준비하면 좋아요/);
  assert.match(rss, /산조 공연은 악기와 장단의 변화를 따라가 보세요/);
  assert.match(rss, /결과전시는 완성도보다 변화의 흔적을 보세요/);
  assert.match(rss, /디저트 체험은 완성품보다 과정을 나눠 보세요/);
  assert.match(rss, /걷기 행사는 내 속도에 맞는 구간을 고르세요/);
  assert.match(rss, /시낭송은 목소리의 속도와 쉼을 들어보세요/);
  assert.match(rss, /국악 공연은 음색이 겹치는 순간을 들어보세요/);
  assert.match(rss, /제목을 작품 사이의 질문으로 바꿔 보세요/);

  const sitemapResponse = await render("/sitemap.xml", "application/xml");
  const sitemap = await sitemapResponse.text();
  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemap, /https:\/\/www\.dongnegogo\.com\/blog<\/loc>/);
  for (const slug of [
    "geumcheon-memory-archive-adult-class-guide",
    "ansan-september-online-breastfeeding-class-guide",
    "chuncheon-sugna-animation-museum-exhibition-guide",
    "gumi-carmen-suite-free-orchestra-guide",
    "sacheon-womens-choir-free-concert-guide",
    "bupyeong-free-kids-ai-coding-class",
    "cheongju-picture-book-garden-exhibition-guide",
    "seoul-junggu-chungmu-swimming-pool-checklist",
    "seoul-guro-free-parent-growth-class",
    "gwangmyeong-peter-pan-musical-guide",
    "daegu-helium-dance-performance-guide",
    "gimje-cosette-musical-guide",
    "gumi-ice-symphony-concert-guide",
    "seoul-musia-musical-guide",
    "goseong-cultural-arts-academy-guide",
    "daegu-harmonica-orchestra-concert-guide",
    "busan-merge-coexistence-exhibition-guide",
    "gangjin-hamaek-festival-guide",
    "seoul-science-museum-plant-atelier-guide",
    "daejeon-youth-choir-letter-concert-guide",
    "incheon-art-platform-summer-vacation-guide",
    "seoul-nowon-kids-career-experience-guide",
    "yeongam-sanjo-festival-guide",
    "yangpyeong-weekend-art-exhibition-guide",
    "mapo-free-parent-tiramisu-class-guide",
    "seoul-heritage-wellness-walking-festival-guide",
    "busan-disabled-poetry-recital-forum-guide",
    "daejeon-season-wave-gugak-concert-guide",
    "jeonju-endless-dialogue-free-exhibition-guide",
    "eunpyeong-music-cities-humanities-class-guide",
    "gunsan-september-intermediate-swimming-class-guide",
    "bucheon-kind-noise-distant-silence-exhibition-guide",
    "mapo-asian-yanggeum-festival-guide",
    "busan-neophilharmonic-87th-concert-guide",
  ]) {
    assert.match(sitemap, new RegExp(`https://www\\.dongnegogo\\.com/blog/${slug}`));
  }
});

test("2026년 8월 29일 편집형 5편은 지역·유형·실제 이미지 출처와 확인된 날짜만 구조화한다", async () => {
  const datedSlugs = new Set([
    "geumcheon-memory-archive-adult-class-guide",
    "chuncheon-sugna-animation-museum-exhibition-guide",
    "gumi-carmen-suite-free-orchestra-guide",
    "sacheon-womens-choir-free-concert-guide",
  ]);
  for (const slug of [
    "geumcheon-memory-archive-adult-class-guide",
    "ansan-september-online-breastfeeding-class-guide",
    "chuncheon-sugna-animation-museum-exhibition-guide",
    "gumi-carmen-suite-free-orchestra-guide",
    "sacheon-womens-choir-free-concert-guide",
  ]) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /사진 출처:.*(?:서울시 문화행사 정보|공유누리|한국문화정보원 한눈에 보는 문화정보)/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /2026-08-29T06:3[5-9]:00\+09:00/);
    if (datedSlugs.has(slug)) assert.match(html, /"@type":"Event"/);
    else assert.doesNotMatch(html, /"@type":"Event"/);
  }
});

test("2026년 8월 28일 편집형 5편은 교육·체육·전시·행사·공연을 실제 이미지와 AEO 스키마로 제공한다", async () => {
  for (const slug of [
    "eunpyeong-music-cities-humanities-class-guide",
    "gunsan-september-intermediate-swimming-class-guide",
    "bucheon-kind-noise-distant-silence-exhibition-guide",
    "mapo-asian-yanggeum-festival-guide",
    "busan-neophilharmonic-87th-concert-guide",
  ]) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /사진 출처:.*(?:서울시 문화행사 정보|서울시 공공서비스예약\(종합\) 정보|서울시 문화행사 공공서비스예약 정보|한국문화정보원 한눈에 보는 문화정보|공유누리)/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /"@type":"Event"/);
    assert.match(html, /2026-08-28T06:3[5-9]:00\+09:00/);
  }
});

test("2026년 8월 27일 편집형 5편은 신규 지역 프로그램·실제 이미지·AEO 스키마를 제공한다", async () => {
  for (const slug of [
    "mapo-free-parent-tiramisu-class-guide",
    "seoul-heritage-wellness-walking-festival-guide",
    "busan-disabled-poetry-recital-forum-guide",
    "daejeon-season-wave-gugak-concert-guide",
    "jeonju-endless-dialogue-free-exhibition-guide",
  ]) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /사진 출처:.*(?:서울시 문화행사 공공서비스예약 정보|서울시 문화행사 정보|한국문화정보원 한눈에 보는 문화정보)/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /"@type":"Event"/);
    assert.match(html, /2026-08-27T06:3[5-9]:00\+09:00/);
  }
});

test("2026년 8월 26일 편집형 5편은 신규 지역 프로그램·실제 이미지·AEO 스키마를 제공한다", async () => {
  for (const slug of [
    "daejeon-youth-choir-letter-concert-guide",
    "incheon-art-platform-summer-vacation-guide",
    "seoul-nowon-kids-career-experience-guide",
    "yeongam-sanjo-festival-guide",
    "yangpyeong-weekend-art-exhibition-guide",
  ]) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /사진 출처:.*(?:한국문화정보원 한눈에 보는 문화정보|서울시 문화행사 공공서비스예약 정보)/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /"@type":"Event"/);
    assert.match(html, /2026-08-26T06:3[5-9]:00\+09:00/);
  }
});

test("오늘의 편집형 5편은 지역·교육·공연·전시·행사를 균형 있게 다루고 실제 이미지와 스키마를 제공한다", async () => {
  for (const slug of [
    "goseong-cultural-arts-academy-guide",
    "daegu-harmonica-orchestra-concert-guide",
    "busan-merge-coexistence-exhibition-guide",
    "gangjin-hamaek-festival-guide",
    "seoul-science-museum-plant-atelier-guide",
  ]) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /사진 출처:.*한국문화정보원 한눈에 보는 문화정보/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /"@type":"Event"/);
    assert.match(html, /2026-08-25T06:3[4-8]:00\+09:00/);
  }
});

test("검색 공유 이미지와 출처가 확인된 공식 프로그램 사진을 구분해 사용한다", async () => {
  const image = await readFile(new URL("public/blog/og.png", projectRoot));
  const data = await readFile(new URL("lib/blog-posts.ts", projectRoot), "utf8");
  assert.ok(image.byteLength > 100_000);
  assert.match(data, /\/markers\/icon_digital\.png/);
  assert.match(data, /\/markers\/icon_exhibition\.png/);
  assert.match(data, /\/markers\/icon_swimming\.png/);
  assert.match(data, /imageSource: "서울시 문화행사 공공서비스예약 정보"/);
  assert.match(data, /umppa\.seoul\.go\.kr\/icare\/webcontent\/icare\/upload\/orgideaExprnCtznFile/);
  assert.match(data, /culture\.go\.kr\/upload\/rdf/);
  assert.match(data, /imageSource: "한국문화정보원 한눈에 보는 문화정보"/);
  assert.doesNotMatch(data, /primary_image_url|program-posters|yeyak\.seoul\.go\.kr\/web\/common\/file/);
});

test("오늘의 구로 부모교육 편집 글은 실제 이미지 출처와 FAQ·실제 날짜 Event 스키마를 제공한다", async () => {
  const response = await render("/blog/seoul-guro-free-parent-growth-class");
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /사진 출처:.*서울시 문화행사 공공서비스예약 정보/);
  assert.match(html, /구로구 무료 부모교육/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"Event"/);
  assert.match(html, /"startDate":"2026-09-14T00:00:00\+09:00"/);
});

test("오늘의 지역 공연 5편은 실제 이미지 출처·FAQ·유료 Event 스키마를 정확히 제공한다", async () => {
  for (const slug of [
    "gwangmyeong-peter-pan-musical-guide",
    "daegu-helium-dance-performance-guide",
    "gimje-cosette-musical-guide",
    "gumi-ice-symphony-concert-guide",
    "seoul-musia-musical-guide",
  ]) {
    const response = await render(`/blog/${slug}`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /사진 출처:.*한국문화정보원 한눈에 보는 문화정보/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /"@type":"Event"/);
    assert.doesNotMatch(html, /"price":0/);
  }
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

test("대표 사진은 작은 배지를, 사진이 없거나 깨지면 중앙 대형 마커만 표시한다", async () => {
  const article = await readFile(new URL("app/blog/program/[id]/page.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  const heroStart = article.indexOf('<div className="blog-article__visual blog-program-hero-media">');
  const heroEnd = article.indexOf("</div>", heroStart);
  const hero = article.slice(heroStart, heroEnd);
  assert.ok(heroStart >= 0);
  assert.doesNotMatch(hero, /blog-program-media-fallback|blog-marker-image/);
  assert.match(hero, /images\[0\] \? <>/);
  assert.match(hero, /<ProgramMediaImage/);
  assert.match(hero, /className="blog-marker-badge"/);
  assert.match(hero, /className="blog-program-marker-fallback"/);
  assert.doesNotMatch(hero, /동네고고 분류 마커/);
  assert.match(styles, /img\.blog-program-marker-fallback, \.blog-program-hero-media > img\.is-media-fallback/);
  assert.match(styles, /width: min\(52%, 220px\)/);
  assert.match(styles, /:has\(> img\.is-media-fallback:not\(\.blog-marker-badge\)\).*\.blog-marker-badge/);
  assert.match(styles, /:has\(> img\.is-media-fallback:not\(\.blog-marker-badge\)\) > span \{ display: none; \}/);
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
  const pagination = await readFile(new URL("components/blog-pagination.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  assert.doesNotMatch(page, /slice\(0, 120\)|getBlogProgramCategoryPage\("교육", 44\)/);
  assert.match(page, /getBlogProgramArchivePage/);
  assert.match(data, /BLOG_ARCHIVE_PAGE_SIZE = 48/);
  assert.match(data, /"교육·강좌": \{ categories: \["교육"\] \}/);
  assert.match(data, /"취미·체험": \{ categories: \["교육", "문화", "문화행사"\]/);
  assert.match(data, /params\.append\("name", "not\.ilike\.\*주차장\*"\)/);
  assert.match(explorer, /<BlogPagination/);
  assert.match(pagination, /className="blog-pagination"/);
  assert.match(pagination, /blog-pagination__edge-slot blog-pagination__edge-slot--previous/);
  assert.match(pagination, /blog-pagination__edge-slot blog-pagination__edge-slot--next/);
  assert.match(styles, /\.blog-pagination__edge-slot--previous \{ justify-self: start; \}/);
  assert.match(styles, /\.blog-pagination__edge-slot--next \{ justify-self: end; \}/);
  assert.match(explorer, /전체 \{total\.toLocaleString\("ko-KR"\)\}개 중/);
});

test("페이지 번호와 이전·다음은 인접 결과를 미리 준비하고 전체 개수는 페이지마다 다시 세지 않는다", async () => {
  const data = await readFile(new URL("lib/blog-program-data.ts", projectRoot), "utf8");
  const pagination = await readFile(new URL("components/blog-pagination.tsx", projectRoot), "utf8");
  const styles = await readFile(new URL("app/blog/blog.css", projectRoot), "utf8");

  assert.match(data, /cachedArchiveRows/);
  assert.match(data, /cachedArchiveTotal/);
  assert.match(data, /Promise\.allSettled\(\[/);
  assert.match(data, /slow exact count must never discard rows/);
  assert.match(data, /method: "HEAD"/);
  assert.match(pagination, /router\.prefetch\(previousHref\)/);
  assert.match(pagination, /router\.prefetch\(nextHref\)/);
  assert.match(pagination, /requestIdleCallback/);
  assert.match(pagination, /aria-busy=\{Boolean\(pendingHref\)\}/);
  assert.match(styles, /\.blog-pagination a\.is-loading/);
});

test("도시 선택 목록은 공식 17개 광역 시·도를 제공하고 모든 탐색 조건에 적용된다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const city = encodeURIComponent("서울특별시");
  const response = await render(`/blog?city=${city}`);
  const html = await response.text();
  const regions = await readFile(new URL("lib/blog-archive-regions.ts", projectRoot), "utf8");
  const data = await readFile(new URL("lib/blog-program-data.ts", projectRoot), "utf8");
  const filters = await readFile(new URL("components/blog-archive-filters.tsx", projectRoot), "utf8");
  const pagination = await readFile(new URL("components/blog-pagination.tsx", projectRoot), "utf8");

  assert.equal(response.status, 200);
  assert.match(html, /도시 선택 :/);
  assert.match(html, /<option value="서울특별시" selected="">서울특별시<\/option>/);
  assert.equal((regions.match(/^  "[^\n]+",$/gm) ?? []).length, 18);
  assert.match(regions, /"강원특별자치도": \["강원특별자치도", "강원도"\]/);
  assert.match(regions, /"전북특별자치도": \["전북특별자치도", "전라북도"\]/);
  assert.match(filters, /onChange=\{\(\) => formRef\.current\?\.requestSubmit\(\)\}/);
  assert.match(data, /params\.set\("region", `eq\.\$\{regions\[0\]\}`\)/);
  assert.match(data, /indexParams\.set\("area_document", `ilike\.\*\$\{city\}\*`\)/);
  assert.match(pagination, /params\.set\("city", city\)/);
  assert.match(html, /href="\/blog\?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&amp;page=2#program-archive-title"/);
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

test("공유누리 원본과 검증 저장본이 같은 시설 사진이면 한 장만 표시한다", {
  skip: !process.env.DONGNEGOGO_SUPABASE_URL || !process.env.DONGNEGOGO_SUPABASE_PUBLISHABLE_KEY,
}, async () => {
  const response = await render(`/blog/program/${encodeURIComponent("program:eshare:08ebf85c71574867")}`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal((html.match(/alt="올림픽기념국민생활관 (?:프로그램|시설) 사진 \d+"/g) ?? []).length, 1);
  assert.match(html, /blog-media-grid blog-media-grid--single/);
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
