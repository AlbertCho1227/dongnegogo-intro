/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { ProgramMediaImage } from "@/components/program-media-image";
import { blogProgramAccent, blogProgramIcon, blogProgramKind } from "@/lib/blog-program";
import { BLOG_ARCHIVE_CATEGORIES, type BlogArchiveCategory, type BlogProgramSummary } from "@/lib/blog-program-data";

function archiveHref(page: number, category: BlogArchiveCategory, query: string): string {
  const params = new URLSearchParams();
  if (category !== "전체") params.set("category", category);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/blog?${suffix}#program-archive-title` : "/blog#program-archive-title";
}

function visiblePages(page: number, totalPages: number): number[] {
  return [...new Set([1, page - 1, page, page + 1, totalPages])].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

export function ProgramStoryExplorer({ programs, total, page, pageSize, category, searchTerm }: {
  programs: BlogProgramSummary[];
  total: number;
  page: number;
  pageSize: number;
  category: BlogArchiveCategory;
  searchTerm: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = total ? Math.min(start + programs.length - 1, total) : 0;
  const pages = visiblePages(page, totalPages);

  return (
    <section className="blog-live-explorer" aria-labelledby="program-archive-title">
      <div className="blog-section-heading">
        <div><span className="blog-eyebrow">LIVE PROGRAM ARCHIVE</span><h2 id="program-archive-title">전국 프로그램 이야기</h2></div>
        <p>주차장은 제외하고 교육·문화·예술·공연·전시·행사·체육·취미 프로그램을 실제 공개 데이터와 사진으로 정리합니다.</p>
      </div>
      <div className="blog-archive-stats"><strong>{total.toLocaleString("ko-KR")}</strong><span>개의 우선 카테고리 후보가 읽기 전용 데이터와 연결되어 있어요. 주차장과 정보가 부족한 항목은 글·검색 사이트맵에서 제외합니다.</span></div>
      <div className="blog-tools">
        <nav className="blog-chips" aria-label="프로그램 글 카테고리 필터">{BLOG_ARCHIVE_CATEGORIES.map((item) => <Link key={item} className={category === item ? "is-active" : undefined} aria-current={category === item ? "page" : undefined} href={archiveHref(1, item, searchTerm)}>{item}</Link>)}</nav>
        <form className="blog-search" action="/blog"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="blog-program-search">프로그램 글 검색</label><input id="blog-program-search" name="q" type="search" defaultValue={searchTerm} placeholder="지역, 공연, 수영, 강좌 검색" />{category !== "전체" && <input type="hidden" name="category" value={category} />}<button type="submit">검색</button></form>
      </div>
      <p className="blog-result-count" aria-live="polite">전체 {total.toLocaleString("ko-KR")}개 중 {start.toLocaleString("ko-KR")}–{end.toLocaleString("ko-KR")}번째 글 · {page.toLocaleString("ko-KR")} / {totalPages.toLocaleString("ko-KR")} 페이지</p>
      <div className="blog-program-grid">{programs.map((program) => {
        const kind = blogProgramKind(program);
        const accent = blogProgramAccent(kind);
        const icon = blogProgramIcon(kind);
        const title = `${program.area || "우리 동네"} ${program.isFree ? "무료 " : ""}${kind} ${program.name} 일정·신청 가이드`;
        return <article className={`blog-program-card blog-accent--${accent}`} key={program.id}>
          <Link className="blog-program-card__media" href={`/blog/program/${encodeURIComponent(program.id)}`}>
            <span className="blog-program-card__fallback" aria-hidden="true"><img src={icon} alt="" /></span>
            {program.imageUrl && <ProgramMediaImage src={program.imageUrl} fallbackSrc={icon} alt={`${program.name} 대표 이미지`} loading="lazy" />}
            <span className="blog-program-card__marker"><img src={icon} alt="" width="42" height="42" /></span>
            <span className="blog-program-card__source">출처: {program.source || "운영기관 공개 데이터"}</span>
          </Link>
          <div className="blog-program-card__body"><div><span>{kind}</span><span>{program.area}</span><span>{program.status}</span></div><h3><Link href={`/blog/program/${encodeURIComponent(program.id)}`}>{title}</Link></h3><p>{program.facility} · {program.periodText || (program.isFree ? "무료 프로그램" : "비용·일정 확인")}</p><Link className="blog-program-card__read" href={`/blog/program/${encodeURIComponent(program.id)}`}>자세히 읽기 <span>→</span></Link></div>
        </article>;
      })}</div>
      {!programs.length && <div className="blog-empty"><strong>일치하는 프로그램 글이 없어요.</strong><p>검색어를 줄이거나 다른 카테고리를 선택해 보세요.</p></div>}
      {totalPages > 1 && <nav className="blog-pagination" aria-label="프로그램 글 페이지">
        {page > 1 && <Link className="blog-pagination__edge" href={archiveHref(page - 1, category, searchTerm)}>← 이전</Link>}
        <div>{pages.map((item, index) => <span key={item}>{index > 0 && item - pages[index - 1] > 1 && <i aria-hidden="true">…</i>}<Link className={item === page ? "is-active" : undefined} aria-current={item === page ? "page" : undefined} href={archiveHref(item, category, searchTerm)}>{item.toLocaleString("ko-KR")}</Link></span>)}</div>
        {page < totalPages && <Link className="blog-pagination__edge" href={archiveHref(page + 1, category, searchTerm)}>다음 →</Link>}
      </nav>}
    </section>
  );
}
