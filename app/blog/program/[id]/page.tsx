/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogHeader } from "@/components/blog-header";
import { ProgramMediaImage } from "@/components/program-media-image";
import {
  blogProgramAccent,
  blogProgramIcon,
  blogProgramKind,
  blogProgramURL,
  isBlogProgram,
  isIndexableBlogProgram,
  isProgramEnded,
  koreanDateOnly,
  programDescription,
  programLongTailTitle,
  visibleSource,
} from "@/lib/blog-program";
import { getSharedProgram, type SharedProgram } from "@/lib/program-share-data";
import { officialProgramAccess } from "@/lib/official-program-access";

type PageProps = { params: Promise<{ id: string }> };

function cleanID(value: string): string {
  try { return decodeURIComponent(value).trim(); } catch { return value.trim(); }
}

function facts(program: SharedProgram) {
  const dates = [koreanDateOnly(program.lectureStart), koreanDateOnly(program.lectureEnd)].filter(Boolean);
  const receipt = [koreanDateOnly(program.receiptStart), koreanDateOnly(program.receiptEnd)].filter(Boolean);
  return [
    { label: "프로그램", value: program.name },
    { label: "장소", value: [program.facility, program.room].filter(Boolean).join(" · ") },
    { label: "주소", value: program.address || program.area || "운영기관 안내에서 확인" },
    { label: "운영 기간", value: dates.length ? dates.join(" ~ ") : program.periodText || "운영기관 안내에서 확인" },
    { label: "신청 기간", value: receipt.length ? receipt.join(" ~ ") : "운영기관 안내에서 확인" },
    { label: "시간", value: program.scheduleText || "회차별 운영시간 확인 필요" },
    { label: "대상", value: program.audiences.length ? program.audiences.join(" · ") : "대상 조건 확인 필요" },
    { label: "비용", value: program.isFree ? "무료" : program.feeText },
    { label: "현재 상태", value: program.status },
  ];
}

function editorialGuide(program: SharedProgram) {
  const kind = blogProgramKind(program);
  if (kind === "체육·수영") return {
    heading: "등록 전에 시간표보다 먼저 볼 것",
    paragraphs: [
      "체육 프로그램은 시설까지의 거리만큼 준비와 회복에 드는 시간도 중요합니다. 이동, 탈의, 샤워 시간을 합친 실제 소요시간을 계산하고 내 수준에 맞는 반인지 확인해야 꾸준히 참여하기 쉽습니다.",
      "수영처럼 단계가 나뉘는 종목은 초급·중급이라는 이름보다 첫 수업에서 요구하는 동작을 확인하세요. 자유수영과 강습의 구분, 준비물, 사물함, 할인 증빙, 환불 기준은 운영기관의 최신 안내가 최종 기준입니다.",
    ],
    checks: ["신규 접수와 기존 회원 재등록 일정", "강습 수준·연령·정원", "탈의·샤워를 포함한 실제 이동 시간", "준비물·시설 이용 규정·환불 기준"],
  };
  if (kind === "공연·연극·뮤지컬") return {
    heading: "관람 만족도를 높이는 사전 확인",
    paragraphs: [
      "공연은 같은 작품이라도 회차, 좌석, 관람 연령에 따라 경험이 달라집니다. 러닝타임과 인터미션, 지연 입장 가능 여부, 어린이 관람 기준을 먼저 확인하면 현장에서 당황할 일이 줄어듭니다.",
      "포스터와 소개 이미지는 작품의 분위기를 이해하는 자료이지만 실제 출연진과 프로그램 구성은 회차별로 바뀔 수 있습니다. 예매 전 공식 페이지의 당일 공지와 좌석 정보를 마지막으로 확인하세요.",
    ],
    checks: ["정확한 공연 회차와 러닝타임", "관람 연령·보호자 동반 기준", "좌석 지정 방식과 취소 수수료", "촬영·음식물·지연 입장 규정"],
  };
  if (kind === "전시·예술") return {
    heading: "전시를 오래 기억하는 관람법",
    paragraphs: [
      "전시장에 들어가기 전 작품의 정답을 미리 정하기보다 제목과 대표 이미지를 보고 무엇이 궁금한지 한 가지 질문을 만들어 보세요. 아이와 함께라면 ‘무엇이 먼저 보였어?’처럼 관찰을 묻는 질문이 긴 설명보다 대화를 오래 이어 줍니다.",
      "무료 전시도 휴관일, 마지막 입장 시간, 연계 체험 예약 여부는 서로 다릅니다. 방문일 기준 공식 안내를 확인하고, 사진 촬영이 가능한 구역과 유모차·휠체어 이동 동선도 함께 살펴보세요.",
    ],
    checks: ["방문일 운영시간과 휴관 여부", "예약·현장 입장 방식", "촬영 가능 구역과 관람 예절", "연계 체험·도슨트의 별도 예약 여부"],
  };
  if (kind === "문화·행사" || kind === "취미·체험") return {
    heading: "행사와 체험을 고를 때 놓치기 쉬운 점",
    paragraphs: [
      "행사 이름에 여러 체험이 함께 적혀 있어도 모든 프로그램이 자유 입장인 것은 아닙니다. 현장 선착순, 사전 예약, 회차별 정원처럼 참여 방식이 나뉠 수 있으므로 원하는 활동의 접수 조건을 따로 확인하세요.",
      "야외 행사는 날씨에 따라 장소와 시간이 바뀔 수 있고, 체험 프로그램은 재료비나 보호자 동반 조건이 추가될 수 있습니다. 출발 직전 운영기관 공지를 확인하면 불필요한 이동을 줄일 수 있습니다.",
    ],
    checks: ["사전 예약·현장 접수·선착순 여부", "체험별 대상 연령과 보호자 동반", "재료비와 현장 추가 비용", "우천·혼잡 시 변경 공지"],
  };
  return {
    heading: "강좌 신청 전에 확인할 기준",
    paragraphs: [
      "교육·강좌는 제목보다 실제 수업 목표와 참여 조건을 비교하는 것이 중요합니다. 한 번의 체험인지 여러 주 이어지는 과정인지, 준비물과 과제가 있는지, 결석했을 때 보강이 가능한지를 확인하면 내 일정에 맞는지 판단하기 쉽습니다.",
      "‘누구나’ 또는 ‘제한 없음’으로 표시되어도 실제 접수 화면에는 연령, 거주지, 회원가입 조건이 추가될 수 있습니다. 동네고고의 요약으로 후보를 좁힌 뒤 운영기관 신청 화면에서 최종 조건을 확인하세요.",
    ],
    checks: ["총 수업 횟수와 휴강·보강 규정", "연령·학년·거주지·회원 조건", "교재·재료·개인 준비물", "수강료 외 추가 비용과 환불 기준"],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const program = await getSharedProgram(cleanID(id)).catch(() => null);
  if (!program || !isBlogProgram(program)) return { title: "프로그램 글을 찾을 수 없어요 | 동네고고" };
  const title = programLongTailTitle(program);
  const description = programDescription(program);
  const url = blogProgramURL(program.id);
  const image = program.images[0]?.url || "https://www.dongnegogo.com/blog/og.png";
  return {
    title: `${title} | 동네고고`,
    description,
    keywords: [program.area, program.name, program.facility, blogProgramKind(program), program.isFree ? "무료 프로그램" : "지역 프로그램"],
    alternates: { canonical: url },
    robots: isIndexableBlogProgram(program) ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: { title, description, url, type: "article", siteName: "동네고고", locale: "ko_KR", images: [{ url: image, alt: `${program.name} 대표 이미지` }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProgramBlogPage({ params }: PageProps) {
  const { id } = await params;
  const program = await getSharedProgram(cleanID(id)).catch(() => null);
  if (!program || !isBlogProgram(program)) notFound();

  const kind = blogProgramKind(program);
  const accent = blogProgramAccent(kind);
  const icon = blogProgramIcon(kind);
  const ended = isProgramEnded(program);
  const title = programLongTailTitle(program);
  const url = blogProgramURL(program.id);
  const guide = editorialGuide(program);
  const officialAccess = officialProgramAccess(program.applyUrl);
  const published = program.updatedAt || "2026-08-22T00:00:00+09:00";
  const images = program.images.slice(0, 8);
  const eventSchema = program.lectureStart ? {
    "@type": "Event",
    name: program.name,
    description: program.description,
    startDate: program.lectureStart,
    ...(program.lectureEnd ? { endDate: program.lectureEnd } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: program.facility, address: program.address || program.area },
    image: images.map((image) => image.url),
    organizer: { "@type": "Organization", name: program.facility, ...(officialAccess ? { url: officialAccess.href } : {}) },
    offers: officialAccess && !officialAccess.requiresHomepageSearch ? { "@type": "Offer", url: officialAccess.href, availability: ended ? "https://schema.org/SoldOut" : "https://schema.org/InStock", ...(program.isFree ? { price: 0, priceCurrency: "KRW" } : {}) } : undefined,
  } : null;
  const faq = [
    { q: `${program.name}은 어디에서 하나요?`, a: `${[program.area, program.facility, program.room].filter(Boolean).join(" · ")}에서 진행됩니다. 정확한 입구와 회차별 장소는 운영기관 안내를 확인하세요.` },
    { q: `지금 신청할 수 있나요?`, a: `동네고고 등록 상태는 ‘${program.status}’입니다.${program.receiptEnd ? ` 신청 마감일은 ${koreanDateOnly(program.receiptEnd)}로 표시됩니다.` : " 별도 신청 기간은 운영기관 안내에서 확인해야 합니다."}` },
    { q: `기간이 끝나면 이 글도 삭제되나요?`, a: "아니요. 일정이 끝난 글도 지역 프로그램 기록과 다음 모집 비교에 도움이 되도록 보존합니다. 다만 현재 모집 여부는 글 상단의 상태 안내를 확인하세요." },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting", "@id": `${url}#article`, mainEntityOfPage: url, headline: title,
        description: programDescription(program), image: images.length ? images.map((image) => image.url) : ["https://www.dongnegogo.com/blog/og.png"],
        datePublished: published, dateModified: published, inLanguage: "ko-KR", articleSection: kind,
        author: { "@type": "Organization", name: "동네고고 편집팀", url: "https://www.dongnegogo.com/blog/about" },
        publisher: { "@type": "Organization", name: "동네고고", url: "https://www.dongnegogo.com", logo: { "@type": "ImageObject", url: "https://www.dongnegogo.com/brand/app-icon.png" } },
        about: { "@type": "Thing", name: program.name },
      },
      ...(eventSchema ? [eventSchema] : []),
      { "@type": "FAQPage", mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "동네고고", item: "https://www.dongnegogo.com" },
        { "@type": "ListItem", position: 2, name: "블로그", item: "https://www.dongnegogo.com/blog" },
        { "@type": "ListItem", position: 3, name: title, item: url },
      ] },
    ],
  };

  return (
    <div className="blog-site blog-article blog-program-article">
      <BlogHeader />
      <main>
        <article>
          <header className={`blog-article__hero blog-accent--${accent}`}>
            <div>
              <nav className="blog-breadcrumbs" aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><Link href="/blog">블로그</Link><span>/</span><span>{kind}</span></nav>
              <div className="blog-article__category"><span>{kind}</span><span>{program.area}</span><span>{program.isFree ? "무료" : "유료·비용 확인"}</span></div>
              <h1>{title}</h1>
              <p className="blog-article__dek">{programDescription(program)}</p>
              <div className="blog-article__byline"><strong>동네고고 프로그램 편집</strong><time dateTime={published}>{koreanDateOnly(published)}</time><span>공개 데이터 기반</span></div>
            </div>
            <div className="blog-article__visual blog-program-hero-media">
              {images[0] && <ProgramMediaImage src={images[0].thumbnailUrl || images[0].url} fallbackSrc={icon} alt={`${program.name} 대표 이미지`} />}
              <img className="blog-marker-badge" src={icon} alt="" width="54" height="54" />
              <span>사진 출처: {images[0] ? visibleSource(images[0], program.source) : "동네고고 분류 마커"}</span>
            </div>
          </header>

          <div className="blog-article__body">
            {ended && <aside className="blog-archive-notice"><strong>지난 프로그램 기록</strong><p>현재 일정은 종료되었거나 접수가 마감된 것으로 표시됩니다. 이 글은 삭제하지 않고 다음 모집과 지역 활동을 비교할 수 있는 기록으로 보존합니다.</p></aside>}

            <div className="blog-article__lead">
              <p>{program.area}에서 {kind}을 찾는 분을 위해 <strong>{program.name}</strong>의 핵심 정보를 한곳에 정리했습니다. 장소는 {program.facility}{program.room ? ` ${program.room}` : ""}이며, 현재 공개 상태는 ‘{program.status}’입니다.</p>
              <p>{program.description}</p>
            </div>

            <aside className="blog-summary-box"><span>먼저 확인하세요</span><p>{ended ? "지난 일정입니다. 재모집 여부는 공식 안내에서 확인하고, 이 페이지는 참고 기록으로 활용하세요." : `${program.isFree ? "무료 프로그램" : program.feeText}으로 등록되어 있습니다. 잔여석과 당일 변경 사항은 공식 안내가 최종 기준입니다.`}</p></aside>

            <section className="blog-facts" aria-labelledby="dynamic-program-facts"><h2 id="dynamic-program-facts">{program.name} 한눈에 보기</h2><dl>{facts(program).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></section>

            {images.length > 1 && <section className="blog-media-story" aria-labelledby="program-media-title">
              <div className="blog-media-story__heading"><span className="blog-eyebrow">PROGRAM &amp; PLACE</span><h2 id="program-media-title">포스터와 시설 사진으로 미리 보기</h2><p>운영기관·공공데이터에서 공개하고 이용 출처를 확인할 수 있는 이미지만 표시합니다.</p></div>
              <div className={`blog-media-grid${images.length === 2 ? " blog-media-grid--single" : ""}`}>{images.slice(1).map((image, index) => <figure key={image.url}><span className="blog-program-media-fallback" aria-hidden="true"><img src={icon} alt="" /></span><ProgramMediaImage src={image.thumbnailUrl || image.url} fallbackSrc={icon} alt={`${program.name} ${image.role.includes("facility") ? "시설" : "프로그램"} 사진 ${index + 1}`} loading="lazy" /><figcaption><strong>{image.role.includes("facility") ? "시설 사진" : "프로그램 이미지"}</strong><span>출처: {visibleSource(image, program.source)}</span>{image.licenseUrl ? <a href={image.licenseUrl} target="_blank" rel="noreferrer">이용조건 확인 ↗</a> : image.license && <span>{image.license}</span>}</figcaption></figure>)}</div>
            </section>}

            <div className="blog-prose">
              <section><h2>{guide.heading}</h2>{guide.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<ul>{guide.checks.map((item) => <li key={item}>{item}</li>)}</ul></section>
              {(program.requirement || program.preparation) && <section><h2>운영기관이 안내한 준비 정보</h2>{program.requirement && <p><strong>참여 조건:</strong> {program.requirement}</p>}{program.preparation && <p><strong>준비 사항:</strong> {program.preparation}</p>}</section>}
              <section><h2>자주 묻는 질문</h2><div className="blog-faq">{faq.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div></section>
            </div>

            <aside className="blog-program-cta"><span>CHECK THE LATEST NOTICE</span><h2>{program.name}</h2><p>동네고고 데이터는 <strong>{program.status}</strong>으로 표시됩니다. 운영기관의 실시간 잔여석·변경 공지를 마지막으로 확인하세요.</p>{officialAccess?.requiresHomepageSearch && <details className="blog-official-guide"><summary>{officialAccess.providerName} 공식 확인 방법 보기</summary><div><strong>상세 주소로 바로 이동하지 않습니다.</strong><p>{officialAccess.providerName} 외부 상세 링크의 접근 보호를 존중해 공식 홈페이지 첫 화면으로 연결합니다. 홈페이지에서 아래 프로그램명을 검색해 주세요. 접근 제한 화면이 보이면 반복해서 누르지 말고 브라우저를 종료한 뒤 운영기관에 문의하세요.</p><code>{program.name}</code><div className="blog-official-guide__actions"><a href={officialAccess.href} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">{officialAccess.providerName} 홈 열기 ↗</a>{program.phone && <a href={`tel:${program.phone.replace(/[^\d+]/g, "")}`}>운영기관 전화 문의</a>}</div></div></details>}<div className="blog-program-cta__actions">{officialAccess && !officialAccess.requiresHomepageSearch ? <a href={officialAccess.href} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">공식 신청·안내 확인 ↗</a> : !officialAccess && <Link href={`/program/${encodeURIComponent(program.id)}`}>동네고고 안내에서 확인</Link>}<Link href={`/program/${encodeURIComponent(program.id)}`}>동네고고 프로그램 보기</Link><Link href="/web">지도에서 주변 찾기</Link></div></aside>
            <p className="blog-source-note"><strong>정보·이미지 출처</strong> {program.source || "운영기관 공개 데이터"}. 표시된 사진마다 확인 가능한 출처와 이용조건을 함께 적었습니다. 본문 안내 문장은 공개된 사실 정보를 바탕으로 동네고고가 새로 구성했으며, 일정·비용·접수 상태는 운영기관 사정에 따라 변경될 수 있습니다.</p>
            <div className="blog-tags"><span>#{program.area.replaceAll(" ", "")}{kind.replaceAll("·", "")}</span><span>#{program.isFree ? "무료프로그램" : "지역프로그램"}</span><span>#{program.facility.replaceAll(" ", "")}</span></div>
          </div>
        </article>
        <aside className="blog-next"><span>KEEP EXPLORING</span><Link href="/blog"><h2>다른 교육·문화·공연·전시·체육 프로그램도 찾아보세요.</h2><i>→</i></Link></aside>
      </main>
      <footer className="blog-footer"><div><strong>동네고고</strong><span>우리 동네의 새로운 하루</span></div><nav><Link href="/">홈</Link><Link href="/blog">블로그</Link><Link href="/blog/about">편집 원칙</Link><a href="/blog/rss.xml">RSS</a></nav><p>© 2026 DongNeGoGo. 지난 프로그램 글도 지역 정보 기록으로 보존합니다.</p></footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
