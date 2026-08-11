import { getPublicProgramStats } from "@/lib/program-stats";

/* eslint-disable @next/next/no-img-element -- Local assets are precompressed and carry explicit dimensions/loading hints. */

const features = [
  {
    eyebrow: "주변 탐색",
    title: "우리 동네 프로그램을\n한눈에 살펴봐요",
    description:
      "교육, 문화·예술, 건강·운동, 공연·전시까지 프로그램 종류를 그림으로 구분해 보여드려요.",
    image: "/screens/map-home.jpg",
    alt: "동네고고 앱의 주변 프로그램 탐색 화면",
  },
  {
    eyebrow: "쉬운 검색",
    title: "프로그램 이름을 몰라도\n쉽게 찾을 수 있어요",
    description:
      "지역이나 관심사를 자연스럽게 입력하면 신청 가능한 프로그램을 가까운 순서로 정리해 드려요.",
    image: "/screens/search.jpg",
    alt: "동네고고 앱의 프로그램 검색 결과 화면",
  },
  {
    eyebrow: "신청 전 확인",
    title: "필요한 정보만 모아\n차근차근 알려드려요",
    description:
      "대상, 기간, 장소, 비용과 신청 링크를 한곳에서 확인하고 원본 공고까지 이어서 볼 수 있어요.",
    image: "/screens/program-detail.jpg",
    alt: "동네고고 앱의 프로그램 상세 화면",
  },
];

const steps = [
  ["1", "찾기", "동네나 관심사를 입력해요"],
  ["2", "살펴보기", "접수 상태와 거리를 확인해요"],
  ["3", "이해하기", "쉬운 설명으로 핵심을 읽어요"],
  ["4", "신청하기", "확인된 신청 페이지로 이동해요"],
];

const audiences = [
  {
    icon: "👨‍👩‍👧",
    title: "아이와 함께",
    description: "주말 체험과 가족 공연을 가까운 곳부터 찾아요.",
    tone: "rose",
  },
  {
    icon: "🌙",
    title: "퇴근 후 가능",
    description: "저녁과 주말에 참여할 수 있는 수업만 골라봐요.",
    tone: "night",
  },
  {
    icon: "👵",
    title: "시니어 추천",
    description: "큰 글씨와 쉬운 설명으로 신청 조건을 확인해요.",
    tone: "leaf",
  },
];

function Phone({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }) {
  return (
    <div className="phone-shell">
      <span className="phone-speaker" aria-hidden="true" />
      <img
        src={src}
        alt={alt}
        width="640"
        height="1385"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding={eager ? "sync" : "async"}
      />
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatSnapshotDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${year}년 ${month}월 ${day}일`;
}

export default async function Home() {
  const stats = await getPublicProgramStats();
  const trustStats = [
    ["전체", stats.totalCount],
    ["문화·예술", stats.cultureCount],
    ["공연", stats.performanceCount],
    ["교육", stats.educationCount],
    ["체육", stats.sportsCount],
  ] as const;

  return (
    <main id="top">
      <header className="site-header">
        <div className="nav-wrap">
          <a className="brand" href="#top" aria-label="동네고고 홈">
            <img src="/brand/app-icon.png" alt="" width="44" height="44" decoding="async" />
            <span>동네고고</span>
          </a>
          <nav aria-label="주요 메뉴">
            <a href="#features">서비스</a>
            <a href="#easy">쉬운 설명</a>
            <a href="#alerts">오픈런 알림</a>
            <a href="#family">가족 도우미</a>
          </nav>
          <a className="nav-cta" href="#experience">앱 미리보기</a>
        </div>
      </header>

      <section className="hero section-pad" aria-labelledby="hero-title">
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow-pill">공공데이터 기반 · AI 쉬운 설명 · 신청 링크 확인</div>
          <h1 id="hero-title">
            우리 주변의 배움과 즐거움을
            <br />
            <span>동네고고 하나로</span>
          </h1>
          <p>
            교육 · 강좌 · 공연 · 체육 · 문화 · 예술 · 전시를
            <br className="desktop-break" /> 가까운 곳부터 쉽고 빠르게 찾아보세요.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#features">서비스 알아보기</a>
            <a className="secondary-button" href="#easy">쉬운 설명 보기</a>
          </div>
          <div className="topic-chips" aria-label="동네고고 추천 주제">
            <span>무료 먼저</span>
            <span>시니어 추천</span>
            <span>아이와 함께</span>
            <span>퇴근 후 가능</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="동네고고 앱 화면 미리보기">
          <div className="mascot-note">
            <span>안녕하세요, 버들이예요!</span>
            <strong>우리 동네의 새로운 하루를 함께 찾아봐요.</strong>
          </div>
          <img className="hero-mascot" src="/brand/beodeuli-wave.png" alt="동네고고 안내 캐릭터 버들이" width="320" height="374" decoding="async" />
          <div className="hero-phone">
            <Phone src="/screens/map-home.jpg" alt="여러 프로그램이 표시된 동네고고 앱 화면" eager />
          </div>
          <div className="floating-card floating-card-top">
            <span className="floating-icon">🎨</span>
            <div><b>문화·예술</b><small>가까운 전시부터</small></div>
          </div>
          <div className="floating-card floating-card-bottom">
            <span className="floating-icon">✓</span>
            <div><b>신청 링크 확인</b><small>매일 새롭게 점검</small></div>
          </div>
        </div>
      </section>

      <section
        className="trust-strip"
        aria-labelledby="program-stats-title"
        data-stats-source={stats.source}
      >
        <div className="trust-heading">
          <h2 id="program-stats-title">지금 동네고고에서 만날 수 있어요</h2>
          <p>현재 이용 가능한 공공 프로그램을 한눈에 확인하세요.</p>
        </div>
        <div className="trust-stats">
          {trustStats.map(([label, count]) => (
            <div className="trust-stat" key={label}>
              <strong>{formatCount(count)}<small>건</small></strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p className="trust-updated">
          <time dateTime={stats.snapshotDate}>{formatSnapshotDate(stats.snapshotDate)} 기준</time>
          <span aria-hidden="true">·</span>
          활성 프로그램 기준
          <span aria-hidden="true">·</span>
          매일 갱신
          <span aria-hidden="true">·</span>
          공연은 다른 분야와 중복될 수 있어요
        </p>
      </section>

      <section id="features" className="section-pad feature-section" aria-labelledby="feature-title">
        <div className="section-heading centered">
          <span>동네고고 서비스</span>
          <h2 id="feature-title">몰라서 놓쳤던 우리 동네 혜택을<br />한곳에서 만나요</h2>
          <p>여러 기관에 흩어진 정보를 모아, 발견부터 신청까지 자연스럽게 이어드려요.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.eyebrow}>
              <div className="feature-phone-wrap">
                <Phone src={feature.image} alt={feature.alt} />
              </div>
              <div className="feature-copy">
                <span>{feature.eyebrow}</span>
                <h3>{feature.title.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="easy" className="easy-section" aria-labelledby="easy-title">
        <div className="section-pad easy-grid">
          <div className="easy-copy">
            <span className="section-kicker">AI 쉬운 설명</span>
            <h2 id="easy-title">어려운 공고문을<br />꼭 필요한 말로 바꿔드려요</h2>
            <p>긴 행정 문서를 그대로 보여주지 않고, 신청 전에 알아야 할 내용을 네 가지 질문으로 정리해요.</p>
            <ul className="check-list">
              <li><span className="check-icon" aria-hidden="true">✓</span>내가 신청할 수 있는지 먼저 확인</li>
              <li><span className="check-icon" aria-hidden="true">✓</span>언제, 어디서, 얼마인지 한눈에 정리</li>
              <li><span className="check-icon" aria-hidden="true">✓</span>확인된 신청 링크나 기관 전화번호 안내</li>
            </ul>
            <div className="mascot-inline">
              <img src="/brand/beodeuli-front.png" alt="버들이" width="220" height="358" loading="lazy" decoding="async" />
              <span>버들이가 어려운 말을<br /><b>쉬운 말로 바꿔드려요.</b></span>
            </div>
          </div>
          <div className="summary-demo">
            <div className="original-notice">
              <span>원래 공고문</span>
              <p>2026년도 하반기 정보화 교육 수강생 모집 공고. 모집 대상은 관내 거주 만 65세 이상 우선 선발 후 잔여 정원에 한하여 일반 어르신을 선착순 배정함...</p>
            </div>
            <div className="summary-arrow" aria-hidden="true">↓</div>
            <div className="easy-summary-card">
              <div className="summary-title"><span>✦</span> 쉽게 정리했어요</div>
              <ol>
                <li><span>신청 기간</span><b>7월 21일까지 신청할 수 있어요.</b></li>
                <li><span>누가 신청하나요</span><b>성북구에 사시는 65세 이상 어르신이 신청할 수 있어요.</b></li>
                <li><span>준비할 것</span><b>신분증을 준비하세요. 수강료는 무료예요.</b></li>
                <li><span>신청 방법</span><b>확인된 신청 페이지나 기관 전화로 안내해 드려요.</b></li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="section-pad journey-section" aria-labelledby="journey-title">
        <div className="section-heading split-heading">
          <div><span>처음 가는 곳도 편안하게</span><h2 id="journey-title">가는 길부터 시설 정보까지<br />미리 확인해요</h2></div>
          <p>앱에서는 도보·대중교통·자동차 경로와 주변 교통, 시설 사진을 단계별로 살펴볼 수 있어요.</p>
        </div>
        <div className="journey-grid">
          <article><Phone src="/screens/transit.jpg" alt="대중교통 경로 안내 화면" /><h3>환승 순서를 차근차근</h3><p>걷는 구간과 타고 내리는 곳을 순서대로 알려드려요.</p></article>
          <article><Phone src="/screens/subway.jpg" alt="지하철 상세 안내 화면" /><h3>경유역과 출구까지</h3><p>몇 정거장인지, 어느 역에서 바꾸는지 자세히 확인해요.</p></article>
          <article><Phone src="/screens/bus-routes.jpg" alt="시설 주변 버스 정보 화면" /><h3>다른 교통수단도 함께</h3><p>시설 주변의 지하철과 버스 정보를 한곳에서 비교해요.</p></article>
        </div>
      </section>

      <section id="alerts" className="section-pad alert-section" aria-labelledby="alert-title">
        <div className="alert-visual"><Phone src="/screens/openrun.jpg" alt="오픈런 알림 화면" /></div>
        <div className="alert-copy">
          <span className="section-kicker">오픈런 알림</span>
          <h2 id="alert-title">인기 강좌의 접수 시작을<br />놓치지 않도록 알려드려요</h2>
          <p>접수 하루 전, 한 시간 전, 10분 전 또는 시작 즉시 원하는 시점에 알림을 받아보세요.</p>
          <div className="alert-options"><span>1일 전</span><span>1시간 전</span><span className="active">10분 전 ✓</span><span>시작 즉시</span></div>
          <div className="steps">
            {steps.map(([number, title, description]) => (
              <div key={number}><b>{number}</b><span><strong>{title}</strong><small>{description}</small></span></div>
            ))}
          </div>
        </div>
      </section>

      <section id="family" className="section-pad family-section" aria-labelledby="family-title">
        <div className="family-card">
          <span className="section-kicker">가족 도우미 모드</span>
          <h2 id="family-title">부모님 대신<br />찾아드릴 수도 있어요</h2>
          <p>부모님 동네를 기준으로 시니어 추천 프로그램을 골라보고, 가족에게 편하게 공유해요.</p>
          <div className="parent-preview">
            <div className="avatar">👵</div>
            <div><b>어머니에게 추천</b><span>집에서 가까운 무료 프로그램</span></div>
            <em>3곳</em>
          </div>
        </div>
        <div className="schedule-card">
          <span className="section-kicker">내 일정</span>
          <h2>찜한 프로그램과<br />신청 일정을 한눈에</h2>
          <p>접수 시작일과 참여 날짜를 모아보고, 잊지 않도록 알림을 설정할 수 있어요.</p>
          <div className="mini-calendar" aria-label="일정 예시">
            <span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span>
            <b>13</b><b>14</b><b className="event">15<small>수영</small></b><b>16</b><b className="event orange">17<small>접수</small></b><b>18</b><b>19</b>
          </div>
        </div>
      </section>

      <section className="section-pad audience-section" aria-labelledby="audience-title">
        <div className="section-heading centered">
          <span>이런 순간, 동네고고</span>
          <h2 id="audience-title">나와 우리 가족에게 맞는<br />새로운 하루를 찾아보세요</h2>
        </div>
        <div className="audience-grid">
          {audiences.map((item) => (
            <article className={`audience-card ${item.tone}`} key={item.title}>
              <span>{item.icon}</span><h3>{item.title}</h3><p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad cta-section">
        <div className="cta-card">
          <img src="/brand/cta-landscape.jpg" alt="" width="2172" height="724" loading="lazy" decoding="async" />
          <div className="cta-overlay" />
          <div className="cta-copy">
            <span>우리 동네에서 시작하는 즐거운 변화</span>
            <h2>오늘도 가까운 곳에서<br />새로운 하루를 만나보세요</h2>
            <p>교육, 문화, 운동, 전시와 공공 혜택을 동네고고가 쉽게 이어드려요.</p>
            <a href="mailto:forestieum@gmail.com">서비스 문의하기</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-wrap">
          <div className="footer-brand"><img src="/brand/app-icon.png" alt="" width="38" height="38" loading="lazy" decoding="async" /><div><b>동네고고</b><span>우리 동네 혜택, 쉽게 찾고 바로 신청해요.</span></div></div>
          <div className="footer-links"><a href="#features">서비스</a><a href="#easy">쉬운 설명</a><a href="#alerts">알림</a><a href="mailto:forestieum@gmail.com">문의</a></div>
          <div className="footer-bottom"><span>© 2026 동네고고</span><span>공공데이터 기반 동네 생활 정보 서비스</span></div>
        </div>
      </footer>
    </main>
  );
}
