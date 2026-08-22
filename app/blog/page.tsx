import Link from "next/link";

import { BlogExplorer } from "@/components/blog-explorer";
import { BlogHeader } from "@/components/blog-header";
import { ProgramStoryExplorer } from "@/components/program-story-explorer";
import { BLOG_POSTS, blogPostUrl } from "@/lib/blog-posts";
import { getBlogProgramArchivePage } from "@/lib/blog-program-data";

type BlogPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const featured = BLOG_POSTS[0];
  const queryParams = await searchParams;
  const requestedPage = Number.parseInt(first(queryParams.page), 10);
  const archive = await getBlogProgramArchivePage({
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
    category: first(queryParams.category),
    searchTerm: first(queryParams.q),
  }).catch(() => ({ programs: [], total: 0, page: 1, pageSize: 48, category: "전체" as const, searchTerm: "" }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": "https://www.dongnegogo.com/blog#blog",
        url: "https://www.dongnegogo.com/blog",
        name: "동네고고 블로그",
        description: "가까운 교육·문화·체육 프로그램을 이해하기 쉽게 소개하는 동네고고 공식 블로그",
        inLanguage: "ko-KR",
        publisher: { "@type": "Organization", name: "동네고고", url: "https://www.dongnegogo.com" },
        blogPost: BLOG_POSTS.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: blogPostUrl(post) })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "동네고고", item: "https://www.dongnegogo.com" },
          { "@type": "ListItem", position: 2, name: "블로그", item: "https://www.dongnegogo.com/blog" },
        ],
      },
    ],
  };

  return (
    <div className="blog-site">
      <BlogHeader />
      <main>
        <section className="blog-hero">
          <div className="blog-hero__copy">
            <span className="blog-eyebrow">DONGNEGOGO EDITORIAL</span>
            <h1>오늘의 동네를<br /><em>조금 더 즐겁게</em></h1>
            <p>교육부터 전시, 공연, 생활체육까지. 신청 전에 정말 궁금한 내용을 동네고고가 읽기 쉽게 정리합니다.</p>
            <div className="blog-hero__actions">
              <a href="#latest-posts-title">최신 이야기 보기</a>
              <Link href="/web">지도에서 직접 찾기 <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <Link className={`blog-featured blog-accent--${featured.accent}`} href={`/blog/${featured.slug}`}>
            <div className="blog-featured__visual">
              <span className="blog-featured__label">EDITOR&apos;S PICK</span>
              <span className="blog-featured__shape blog-featured__shape--one" />
              <span className="blog-featured__shape blog-featured__shape--two" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={featured.iconPath} alt={featured.imageAlt} width="146" height="146" />
            </div>
            <div className="blog-featured__copy">
              <span>{featured.category} · {featured.region}</span>
              <h2>{featured.title}</h2>
              <p>{featured.dek}</p>
              <strong>지금 읽기 <span aria-hidden="true">→</span></strong>
            </div>
          </Link>
        </section>

        <BlogExplorer posts={BLOG_POSTS} />

        <ProgramStoryExplorer {...archive} />

        <section className="blog-promise" aria-labelledby="editorial-promise-title">
          <div>
            <span className="blog-eyebrow">OUR PROMISE</span>
            <h2 id="editorial-promise-title">복사하지 않고,<br />확인하고 씁니다.</h2>
          </div>
          <ul>
            <li><strong>사실은 출처와 함께</strong><span>공개 데이터의 날짜·장소·신청 상태를 확인합니다.</span></li>
            <li><strong>본문은 동네고고의 언어로</strong><span>원문을 옮기지 않고 선택과 준비에 도움이 되게 다시 씁니다.</span></li>
            <li><strong>마지막 결정은 공식 안내에서</strong><span>변경될 수 있는 잔여석·비용·운영시간은 공식 링크로 연결합니다.</span></li>
          </ul>
          <Link href="/blog/about">편집·저작권 원칙 자세히 보기 <span aria-hidden="true">→</span></Link>
        </section>
      </main>
      <footer className="blog-footer">
        <div><strong>동네고고</strong><span>우리 동네의 새로운 하루</span></div>
        <nav aria-label="블로그 하단 메뉴"><Link href="/">홈</Link><Link href="/web">지도</Link><Link href="/blog/about">편집 원칙</Link><a href="/blog/rss.xml">RSS</a></nav>
        <p>© 2026 DongNeGoGo. 일정과 접수 상태는 운영기관 사정에 따라 변경될 수 있습니다.</p>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
