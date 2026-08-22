"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";

import { ProgramMediaImage } from "@/components/program-media-image";
import { blogProgramAccent, blogProgramIcon, blogProgramKind } from "@/lib/blog-program";
import type { BlogProgramSummary } from "@/lib/blog-program-data";

const CATEGORIES = ["전체", "교육·강좌", "공연·연극·뮤지컬", "전시·예술", "문화·행사", "체육·수영", "취미·체험"] as const;

export function ProgramStoryExplorer({ programs, total }: { programs: BlogProgramSummary[]; total: number }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("전체");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.normalize("NFC").trim().toLocaleLowerCase("ko-KR");
    return programs.filter((program) => {
      const kind = blogProgramKind(program);
      if (category !== "전체" && kind !== category) return false;
      if (!needle) return true;
      return [program.name, program.area, program.facility, program.field, program.source, kind]
        .filter(Boolean).join(" ").normalize("NFC").toLocaleLowerCase("ko-KR").includes(needle);
    });
  }, [category, programs, query]);

  return (
    <section className="blog-live-explorer" aria-labelledby="program-archive-title">
      <div className="blog-section-heading">
        <div><span className="blog-eyebrow">LIVE PROGRAM ARCHIVE</span><h2 id="program-archive-title">전국 프로그램 이야기</h2></div>
        <p>주차장은 제외하고 교육·문화·예술·공연·전시·행사·체육·취미 프로그램을 실제 공개 데이터와 사진으로 정리합니다.</p>
      </div>
      <div className="blog-archive-stats"><strong>{total.toLocaleString("ko-KR")}</strong><span>개의 우선 카테고리 후보가 읽기 전용 데이터와 연결되어 있어요. 주차장과 정보가 부족한 항목은 글·검색 사이트맵에서 제외합니다.</span></div>
      <div className="blog-tools">
        <div className="blog-chips" role="group" aria-label="프로그램 글 카테고리 필터">{CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? "is-active" : undefined} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <label className="blog-search"><span className="sr-only">프로그램 글 검색</span><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역, 공연, 수영, 강좌 검색" /></label>
      </div>
      <p className="blog-result-count" aria-live="polite">최근 글 {filtered.length}개를 표시하고 있어요</p>
      <div className="blog-program-grid">{filtered.map((program) => {
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
      {!filtered.length && <div className="blog-empty"><strong>일치하는 프로그램 글이 없어요.</strong><p>검색어를 줄이거나 다른 카테고리를 선택해 보세요.</p></div>}
    </section>
  );
}
