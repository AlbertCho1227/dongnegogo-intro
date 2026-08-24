/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { ProgramMediaImage } from "@/components/program-media-image";
import { blogProgramAccent, blogProgramIcon, blogProgramKind, koreanDateOnly } from "@/lib/blog-program";
import type { BlogProgramSummary } from "@/lib/blog-program-data";

function displayText(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;|&#x27;|&rsquo;/gi, "’")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function BlogExplorer({ programs }: { programs: BlogProgramSummary[] }) {
  return (
    <section className="blog-explorer" aria-labelledby="latest-posts-title">
      <div className="blog-section-heading">
        <div>
          <span className="blog-eyebrow">LATEST UPDATES</span>
          <h2 id="latest-posts-title">가장 최근 업데이트된 이야기</h2>
        </div>
        <p>동네고고에 새롭게 반영된 전국 프로그램 중 최신 자료 3개를 먼저 확인해 보세요.</p>
      </div>

      <p className="blog-result-count">가장 최근 업데이트된 {programs.length}개의 이야기예요</p>
      {programs.length ? (
        <div className="blog-card-grid">
          {programs.map((program) => {
            const kind = blogProgramKind(program);
            const accent = blogProgramAccent(kind);
            const icon = blogProgramIcon(kind);
            const href = `/blog/program/${encodeURIComponent(program.id)}`;
            const updatedDate = koreanDateOnly(program.updatedAt);
            const name = displayText(program.name);
            const title = `${program.area || "우리 동네"} ${program.isFree ? "무료 " : ""}${kind} ${name} 일정·신청 가이드`;
            return (
              <article className={`blog-card blog-accent--${accent}`} key={program.id}>
                <Link className="blog-card__visual" href={href} tabIndex={-1} aria-hidden="true">
                  <span className="blog-card__orb" />
                  {program.imageUrl
                    ? <ProgramMediaImage className="blog-card__image" src={program.imageUrl} fallbackSrc={icon} alt={`${name} 대표 이미지`} loading="lazy" />
                    : <img src={icon} alt="" width="88" height="88" />}
                  <span className="blog-card__region">{program.area || "전국"}</span>
                </Link>
                <div className="blog-card__body">
                  <div className="blog-card__meta">
                    <span>{kind}</span>
                    {updatedDate && <time dateTime={program.updatedAt ?? undefined}>{updatedDate}</time>}
                    <span>최신 업데이트</span>
                  </div>
                  <h3><Link href={href}>{title}</Link></h3>
                  <p>{program.facility} · {program.periodText || (program.isFree ? "무료 프로그램" : "비용·일정 확인")}</p>
                  <div className="blog-card__footer">
                    <span>{program.status}</span>
                    <Link href={href} aria-label={`${name} 읽기`}>읽어보기 <span aria-hidden="true">→</span></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="blog-empty">
          <strong>최신 프로그램을 불러오는 중이에요.</strong>
          <p>잠시 후 다시 확인해 주세요.</p>
        </div>
      )}
    </section>
  );
}
