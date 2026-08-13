import { getPublicProgramStats } from "@/lib/program-stats";
import OriginalDesignBehavior from "./original-design-behavior";
import originalDesignDocument from "./original-design.dc.html?raw";

type PublicStats = Awaited<ReturnType<typeof getPublicProgramStats>>;

const STYLE_OPEN = "<style>";
const STYLE_CLOSE = "</style>";
const PAGE_OPEN = '<div style="width:100%;background:#FFFFFF">';
const PAGE_CLOSE = "</x-dc>";
const ORIGINAL_STATS_OPEN = '    <div data-r="stats"';
const MASCOT_OPEN = '  <div style="position: absolute; left: 40px;';
const PRIMARY_NAV_OPEN = '    <div style="flex:1 1 auto;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px 14px;font-size:15px;font-weight:600;color:#42473F;white-space:nowrap">';
const HERO_BADGE_OPEN = '    <div style="display:flex;align-items:center;gap:8px;background:#FFFFFF;border:1px solid #DDF0C9;border-radius:999px;padding:9px 18px;font-size:15px;font-weight:700;color:#2FA84F;box-shadow:0 2px 8px rgba(58,178,79,0.1)">';
const HERO_BADGE_COPY = '      공공데이터 기반 · AI 쉬운 설명 · 신청 링크 확인됨';
const HERO_BADGE_COPY_RESPONSIVE = '      <span data-r="hero-badge-primary">공공데이터 기반 · AI 쉬운 설명</span><span data-r="hero-badge-secondary">신청 링크 확인됨</span>';
const HERO_TITLE = '    <h1 style="margin:0;font-size:54px;font-weight:900;line-height:1.28;letter-spacing:-0.02em;color:#20241F">우리&nbsp;<span style="background-color: initial;">주변의 배움과 즐거움을&nbsp; 한눈에<br></span><span style="background-color: initial;"></span>&nbsp;<span style="background: linear-gradient(135deg, rgb(107, 190, 46) 0%, rgb(47, 180, 87) 100%) text; color: transparent;">동네고고 하나로</span></h1>';
const HERO_TITLE_RESPONSIVE = '    <h1 data-r="hero-title" style="margin:0;font-size:54px;font-weight:900;line-height:1.28;letter-spacing:-0.02em;color:#20241F"><span data-r="responsive-line">우리 주변의 배움&nbsp;과&nbsp;</span><br data-r="mobile-break"><span data-r="responsive-line">즐거움을 한눈에</span><br><span data-r="responsive-line" style="background: linear-gradient(135deg, rgb(107, 190, 46) 0%, rgb(47, 180, 87) 100%) text; color: transparent;">동네고고 하나로</span></h1>';
const HERO_CATEGORY_COPY = '    <div style="font-size: 21px; font-weight: 700; color: #0D0D0D; line-height: 1.6">교육 · 강좌 · 공연 · 체육 · 문화 · 예술 · 전시&nbsp;<br>행사를 지도에서 한눈에 찾아보세요</div>';
const HERO_CATEGORY_COPY_RESPONSIVE = '    <div data-r="hero-category" style="font-size: 21px; font-weight: 700; color: #0D0D0D; line-height: 1.6"><span>교육 · 강좌 · 공연 · 체육</span><span data-r="hero-category-separator"> · </span><span data-r="hero-category-break"><br></span><span>문화 · 예술 · 전시</span>&nbsp;<br>행사를 지도에서 한눈에 찾아보세요</div>';
const MAP_HEADING = '    <div style="font-size:36px;font-weight:900;letter-spacing:-0.02em">강좌와 행사가 지도 위에 아이콘으로 떠 있어요</div>';
const MAP_HEADING_RESPONSIVE = '    <div data-r="map-heading" style="font-size:36px;font-weight:900;letter-spacing:-0.02em"><span data-r="responsive-line">강좌와 행사가 지도 위에</span><br data-r="mobile-break"><span data-r="responsive-line">아이콘으로 떠 있어요</span></div>';
const ROUTE_HEADING = '        <div style="font-size:30px;font-weight:900;letter-spacing:-0.02em;line-height:1.35">"거기 어떻게 가요?"<br>가는 길과 도착 풍경까지 미리</div>';
const ROUTE_HEADING_RESPONSIVE = '        <div data-r="route-heading" style="font-size:30px;font-weight:900;letter-spacing:-0.02em;line-height:1.35">"거기 어떻게 가요?"<br><span data-r="responsive-line">가는 길과 도착 풍경까지</span><span data-r="desktop-only"> </span><br data-r="mobile-break"><span data-r="responsive-line">미리<span data-r="mobile-only"> 확인</span></span></div>';
const PERSONA_HEADING = '    <div style="font-size:36px;font-weight:900;letter-spacing:-0.02em">누구에게나 딱 맞는 동네 생활</div>';
const PERSONA_HEADING_RESPONSIVE = '    <div data-r="persona-heading" style="font-size:36px;font-weight:900;letter-spacing:-0.02em"><span data-r="responsive-line">누구에게나 딱 맞는</span><br data-r="mobile-break"><span data-r="responsive-line">동네 생활</span></div>';
const STORIES_HEADING = '    <div style="font-size:36px;font-weight:900;letter-spacing:-0.02em">우리 동네 모든 무료·공공 혜택,<br>지도 하나로</div>';
const STORIES_HEADING_RESPONSIVE = '    <div data-r="stories-heading" style="font-size:36px;font-weight:900;letter-spacing:-0.02em"><span data-r="responsive-line">우리 동네 모든 무료</span><span data-r="desktop-only">·</span><br data-r="mobile-break"><span data-r="responsive-line">공공 혜택,</span><br><span data-r="responsive-line">지도 하나로</span></div>';
const HERO_SEARCH_OPEN = '    <div style="width:100%;max-width:640px;height:68px;';
const ROUTE_SHOTS_OPEN = '    <div style="display:flex;gap:20px;justify-content:center">';
const ROUTE_SHOTS_CLOSE = '    </div>\n  </div>\n\n  <!-- 4-up -->';
const PROOF_ACTIONS_OPEN = '    <div style="display:flex;gap:10px;flex:none">';
const OPENRUN_TIMING_OPEN = '    <div style="display:flex;gap:8px;padding-bottom:4px">\n      <div style="border-radius:999px;padding:10px 16px;font-size:14.5px;font-weight:600;background:#FFFFFF;color:#42473F;border:1.5px solid #E2E4E2">1일 전</div>';
const OPENRUN_TIMING_MARKED = '    <div data-r="openrun-timing" style="display:flex;gap:8px;padding-bottom:4px">\n      <div style="border-radius:999px;padding:10px 16px;font-size:14.5px;font-weight:600;background:#FFFFFF;color:#42473F;border:1.5px solid #E2E4E2">1일 전</div>';
const FAMILY_ACTIONS_OPEN = '      <div style="display:flex;gap:8px">\n        <div style="flex:1;height:48px;border-radius:13px;background:#FEE500;display:flex;align-items:center;justify-content:center;gap:7px;font-size:15px;font-weight:800;color:#3B1E1E">';
const FAMILY_ACTIONS_MARKED = '      <div data-r="family-actions" style="display:flex;gap:8px">\n        <div style="flex:1;height:48px;border-radius:13px;background:#FEE500;display:flex;align-items:center;justify-content:center;gap:7px;font-size:15px;font-weight:800;color:#3B1E1E">';
const CLOSING_CTA_COPY_OPEN = '    <div style="position: relative; display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(6px);';
const CLOSING_CTA_COPY_MARKED = '    <div data-r="closing-cta-copy" style="position: relative; display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(6px);';
const TO_TOP_OPEN = '<a href="#top" id="to-top" title="맨 위로"';
const TO_TOP_MARKED = '<a href="#top" id="to-top" data-r="to-top" aria-label="위로 가기" title="위로 가기"';
const HERO_MASCOT_MARKER = '<div data-r="hero-mascot"';
const FOUR_STEP_HEADING = '    <div style="font-size:26px;font-weight:900;letter-spacing:-0.02em">신청까지 네 걸음이면 충분해요</div>';
const FOUR_STEP_HEADING_WITH_MASCOT = `    <div data-r="four-step-heading">
      <img src="assets/beodeuli-search.png" alt="돋보기로 프로그램을 찾는 버들이">
      <div style="font-size:26px;font-weight:900;letter-spacing:-0.02em"><span data-r="responsive-line">신청까지 네 걸음이면</span><br data-r="mobile-break"><span data-r="responsive-line">충분해요</span></div>
    </div>`;
const ORIGINAL_PROGRAM_DETAIL_IMAGE = '<img src="uploads/52BE0BAF-8B8E-4A2F-B0F8-3B6A535B8079.png" alt="" style="display:block;width:100%;border-radius:20px 20px 0 0">';
const SUMMER_MEDIAWALL_PROGRAM_DETAIL_IMAGE = '<img src="uploads/program-detail-summer-mediawall.png" alt="2026 동네고고 미디어아트 전시 여름빛 미디어월 프로그램 상세 화면" style="display:block;width:100%;border-radius:20px 20px 0 0">';
const ORIGINAL_LEGAL_LINKS = '<div style="display:flex;gap:18px"><span>이용약관</span><span>개인정보처리방침</span><span>공공데이터 이용정책</span></div>';
const LINKED_LEGAL_LINKS = '<nav aria-label="법적 고지" style="display:flex;gap:18px;flex-wrap:wrap"><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a><a href="/location-terms">위치기반서비스 이용약관</a><a href="/public-data">공공데이터 이용정책</a><a href="/account-deletion">계정·데이터 삭제</a></nav>';

function sliceRequired(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  if (start < 0 || end < 0) {
    throw new Error(`Original design marker is missing: ${startMarker}`);
  }

  return source.slice(start + startMarker.length, end);
}

function replaceRequired(source: string, marker: string, replacement: string) {
  if (!source.includes(marker)) {
    throw new Error(`Original responsive marker is missing: ${marker}`);
  }
  return source.replace(marker, replacement);
}

const originalDesignStyles = sliceRequired(
  originalDesignDocument,
  STYLE_OPEN,
  STYLE_CLOSE,
);

const originalPageMarkup = (() => {
  const fullMarkup = PAGE_OPEN + sliceRequired(
    originalDesignDocument,
    PAGE_OPEN,
    PAGE_CLOSE,
  );
  const statsStart = fullMarkup.indexOf(ORIGINAL_STATS_OPEN);
  const mascotStart = fullMarkup.indexOf(MASCOT_OPEN, statsStart);

  if (statsStart < 0 || mascotStart < 0) {
    throw new Error("Original hero statistics block could not be located.");
  }

  const withoutOriginalStats = fullMarkup.slice(0, statsStart) + fullMarkup.slice(mascotStart);
  if (!withoutOriginalStats.includes(ORIGINAL_LEGAL_LINKS)) {
    throw new Error("Original legal footer links could not be located.");
  }
  const routePager = `
    </div>
    <div data-r="route-pager" role="group" aria-label="길찾기 화면 넘기기">
      <button type="button" data-route-page="0" aria-label="첫 번째 길찾기 화면 보기" aria-current="true">1</button>
      <button type="button" data-route-page="1" aria-label="두 번째 거리뷰 화면 보기" aria-current="false">2</button>
    </div>
    <p data-r="route-status" aria-live="polite">1 / 2</p>
  </div>
  </div>

  <!-- 4-up -->`;

  return [
    [PRIMARY_NAV_OPEN, PRIMARY_NAV_OPEN.replace("<div", '<div data-r="primary-nav"')],
    [HERO_BADGE_OPEN, HERO_BADGE_OPEN.replace("<div", '<div data-r="hero-badge"')],
    [HERO_BADGE_COPY, HERO_BADGE_COPY_RESPONSIVE],
    [HERO_TITLE, HERO_TITLE_RESPONSIVE],
    [HERO_CATEGORY_COPY, HERO_CATEGORY_COPY_RESPONSIVE],
    [MAP_HEADING, MAP_HEADING_RESPONSIVE],
    [ROUTE_HEADING, ROUTE_HEADING_RESPONSIVE],
    [PERSONA_HEADING, PERSONA_HEADING_RESPONSIVE],
    [STORIES_HEADING, STORIES_HEADING_RESPONSIVE],
    [MASCOT_OPEN, MASCOT_OPEN.replace("<div", '<div data-r="hero-mascot"')],
    [HERO_SEARCH_OPEN, HERO_SEARCH_OPEN.replace("<div", '<div data-r="hero-search"')],
    [ROUTE_SHOTS_OPEN, `<div data-r="route-gallery"><div data-r="route-carousel" style="display:flex;gap:20px;justify-content:center">`],
    [ROUTE_SHOTS_CLOSE, routePager],
    [FOUR_STEP_HEADING, FOUR_STEP_HEADING_WITH_MASCOT],
    [ORIGINAL_PROGRAM_DETAIL_IMAGE, SUMMER_MEDIAWALL_PROGRAM_DETAIL_IMAGE],
    [PROOF_ACTIONS_OPEN, PROOF_ACTIONS_OPEN.replace("<div", '<div data-r="proof-actions"')],
    [OPENRUN_TIMING_OPEN, OPENRUN_TIMING_MARKED],
    [FAMILY_ACTIONS_OPEN, FAMILY_ACTIONS_MARKED],
    [CLOSING_CTA_COPY_OPEN, CLOSING_CTA_COPY_MARKED],
    [TO_TOP_OPEN, TO_TOP_MARKED],
    [ORIGINAL_LEGAL_LINKS, LINKED_LEGAL_LINKS],
  ].reduce((markup, [marker, replacement]) => replaceRequired(markup, marker, replacement), withoutOriginalStats);
})();

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatSnapshotDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}년 ${month}월 ${day}일`;
}

function buildStatsMarkup(stats: PublicStats) {
  const items = [
    ["전체", stats.totalCount],
    ["문화·예술", stats.cultureCount],
    ["공연", stats.performanceCount],
    ["교육", stats.educationCount],
    ["체육", stats.sportsCount],
  ] as const;
  const source = stats.source === "rpc" ? "rpc" : "fallback";
  const statsMarkup = items.map(([label, count]) => `
          <div class="trust-stat">
            <strong>${formatCount(count)}<small>건</small></strong>
            <span>${label}</span>
          </div>`).join("");

  return `
    <section class="trust-strip" aria-labelledby="program-stats-title" data-stats-source="${source}">
      <div class="trust-heading">
        <h2 id="program-stats-title">지금 동네고고에서 만날 수 있어요</h2>
        <p>현재 이용 가능한 공공 프로그램을 한눈에 확인하세요.</p>
      </div>
      <div class="trust-stats">${statsMarkup}
      </div>
      <p class="trust-updated">
        <time datetime="${stats.snapshotDate}">${formatSnapshotDate(stats.snapshotDate)} 기준</time>
        <span aria-hidden="true">·</span>
        활성 프로그램 기준
        <span aria-hidden="true">·</span>
        매일 갱신
        <span aria-hidden="true">·</span>
        공연은 다른 분야와 중복될 수 있어요
      </p>
    </section>
  `;
}

export default async function Home() {
  const stats = await getPublicProgramStats();
  const pageMarkup = replaceRequired(
    originalPageMarkup,
    HERO_MASCOT_MARKER,
    `${buildStatsMarkup(stats)}\n  ${HERO_MASCOT_MARKER}`,
  );

  return (
    <main>
      <style dangerouslySetInnerHTML={{ __html: originalDesignStyles }} />
      <div dangerouslySetInnerHTML={{ __html: pageMarkup }} />
      <OriginalDesignBehavior />
    </main>
  );
}
