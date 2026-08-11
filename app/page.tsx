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
const HERO_SEARCH_OPEN = '    <div style="width:100%;max-width:640px;height:68px;';
const ROUTE_SHOTS_OPEN = '    <div style="display:flex;gap:20px;justify-content:center">';
const ROUTE_SHOTS_CLOSE = '    </div>\n  </div>\n\n  <!-- 4-up -->';
const PROOF_ACTIONS_OPEN = '    <div style="display:flex;gap:10px;flex:none">';
const HERO_MASCOT_MARKER = '<div data-r="hero-mascot"';
const HERO_SPEECH_ROW_BREAK = '</span><br>\n      <span style="color: #2FA84F; text-align: left">';
const HERO_SPEECH_QUESTION_BREAK = '동네 마실<br>나가볼까요?';
const FOUR_STEP_HEADING = '    <div style="font-size:26px;font-weight:900;letter-spacing:-0.02em">신청까지 네 걸음이면 충분해요</div>';
const FOUR_STEP_HEADING_WITH_MASCOT = `    <div data-r="four-step-heading">
      <img src="assets/beodeuli-search.png" alt="돋보기로 프로그램을 찾는 버들이">
      <div style="font-size:26px;font-weight:900;letter-spacing:-0.02em">신청까지 네 걸음이면 충분해요</div>
    </div>`;
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
    [MASCOT_OPEN, MASCOT_OPEN.replace("<div", '<div data-r="hero-mascot"')],
    [HERO_SPEECH_ROW_BREAK, HERO_SPEECH_ROW_BREAK.replace("</span><br>", "</span> ")],
    [HERO_SPEECH_QUESTION_BREAK, "동네 마실 나가볼까요?"],
    [HERO_SEARCH_OPEN, HERO_SEARCH_OPEN.replace("<div", '<div data-r="hero-search"')],
    [ROUTE_SHOTS_OPEN, `<div data-r="route-gallery"><div data-r="route-carousel" style="display:flex;gap:20px;justify-content:center">`],
    [ROUTE_SHOTS_CLOSE, routePager],
    [FOUR_STEP_HEADING, FOUR_STEP_HEADING_WITH_MASCOT],
    [PROOF_ACTIONS_OPEN, PROOF_ACTIONS_OPEN.replace("<div", '<div data-r="proof-actions"')],
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
