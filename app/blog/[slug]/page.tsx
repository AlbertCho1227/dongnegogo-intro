import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogHeader } from "@/components/blog-header";
import { ProgramMediaImage } from "@/components/program-media-image";
import { BLOG_POSTS, blogPostUrl, getBlogPost, koreanDate } from "@/lib/blog-posts";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "이야기를 찾을 수 없어요 | 동네고고" };
  const url = blogPostUrl(post);
  const socialImage = post.imageUrl || "https://www.dongnegogo.com/blog/og.png";
  return {
    title: post.seoTitle,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: "동네고고 편집팀", url: "https://www.dongnegogo.com/blog/about" }],
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: "article",
      siteName: "동네고고",
      locale: "ko_KR",
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt,
      authors: ["동네고고 편집팀"],
      section: post.category,
      tags: post.tags,
      images: [{ url: socialImage, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [socialImage] },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();
  const currentIndex = BLOG_POSTS.findIndex((item) => item.slug === post.slug);
  const nextPost = BLOG_POSTS[(currentIndex + 1) % BLOG_POSTS.length];
  const programPath = `/program/${encodeURIComponent(post.programId)}`;
  const articleImage = post.imageUrl || "https://www.dongnegogo.com/blog/og.png";
  const isFreeEvent = post.facts.some((fact) => fact.label === "비용" && /무료/.test(fact.value));
  const faq = [
    { q: `${post.programName}은 어디에서 진행되나요?`, a: `${post.eventLocation || post.region}에서 진행됩니다. 정확한 입구와 당일 장소는 공식 안내를 확인하세요.` },
    { q: "지금 신청할 수 있나요?", a: `동네고고 확인 상태는 ‘${post.programStatus}’입니다. 접수 시작·마감과 잔여석은 공식 안내가 최종 기준입니다.` },
    { q: "일정이 끝나면 글이 삭제되나요?", a: "아니요. 지난 프로그램도 다음 모집과 지역 활동을 비교할 수 있도록 기록으로 보존합니다." },
  ];
  const eventSchema = post.eventStart ? {
    "@type": "Event",
    name: post.programName,
    description: post.description,
    startDate: post.eventStart,
    ...(post.eventEnd ? { endDate: post.eventEnd } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: post.eventLocation || post.region, address: post.region },
    image: [articleImage],
    organizer: { "@type": "Organization", name: post.sourceName, url: post.officialUrl },
    offers: {
      "@type": "Offer",
      url: post.officialUrl,
      availability: "https://schema.org/InStock",
      ...(isFreeEvent ? { price: 0, priceCurrency: "KRW" } : {}),
    },
  } : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${blogPostUrl(post)}#article`,
        mainEntityOfPage: blogPostUrl(post),
        headline: post.title,
        description: post.description,
        image: [articleImage],
        datePublished: post.publishedAt,
        dateModified: post.modifiedAt,
        inLanguage: "ko-KR",
        articleSection: post.category,
        keywords: post.tags.join(", "),
        author: { "@type": "Organization", name: "동네고고 편집팀", url: "https://www.dongnegogo.com/blog/about" },
        publisher: {
          "@type": "Organization",
          name: "동네고고",
          url: "https://www.dongnegogo.com",
          logo: { "@type": "ImageObject", url: "https://www.dongnegogo.com/brand/app-icon.png" },
        },
        isPartOf: { "@id": "https://www.dongnegogo.com/blog#blog" },
        about: { "@type": "Thing", name: post.programName },
      },
      ...(eventSchema ? [eventSchema] : []),
      { "@type": "FAQPage", mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "동네고고", item: "https://www.dongnegogo.com" },
          { "@type": "ListItem", position: 2, name: "블로그", item: "https://www.dongnegogo.com/blog" },
          { "@type": "ListItem", position: 3, name: post.title, item: blogPostUrl(post) },
        ],
      },
    ],
  };

  return (
    <div className="blog-site blog-article">
      <BlogHeader />
      <main>
        <article>
          <header className={`blog-article__hero blog-accent--${post.accent}`}>
            <div>
              <nav className="blog-breadcrumbs" aria-label="현재 위치">
                <Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/blog">블로그</Link><span aria-hidden="true">/</span><span>{post.category}</span>
              </nav>
              <div className="blog-article__category"><span>{post.category}</span><span>{post.region}</span><span>{post.audience}</span></div>
              <h1>{post.title}</h1>
              <p className="blog-article__dek">{post.dek}</p>
              <div className="blog-article__byline">
                <strong>동네고고 편집팀</strong>
                <time dateTime={post.publishedAt}>{koreanDate(post.publishedAt)}</time>
                <span>{post.readingMinutes}분 읽기</span>
              </div>
            </div>
            <div className={`blog-article__visual${post.imageUrl ? " blog-program-hero-media" : ""}`}>
              {post.imageUrl ? <>
                <ProgramMediaImage src={post.imageUrl} fallbackSrc={post.iconPath} alt={post.imageAlt} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="blog-marker-badge" src={post.iconPath} alt="" width="54" height="54" />
                <span>사진 출처: {post.imageSource || post.sourceName}</span>
              </> : <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.iconPath} alt={post.imageAlt} width="150" height="150" />
                <span>동네고고 자체 분류 아이콘 · 외부 사진 미사용</span>
              </>}
            </div>
          </header>

          <div className="blog-article__body">
            <div className="blog-article__lead">
              {post.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>

            <aside className="blog-summary-box" aria-label="한 줄 요약">
              <span>한 줄 요약</span>
              <p>{post.takeaway}</p>
            </aside>

            <section className="blog-facts" aria-labelledby="program-facts-title">
              <h2 id="program-facts-title">프로그램 한눈에 보기</h2>
              <dl>{post.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
            </section>

            <div className="blog-prose">
              {post.sections.map((section) => (
                <section key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                </section>
              ))}
              <section><h2>자주 묻는 질문</h2><div className="blog-faq">{faq.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div></section>
            </div>

            <aside className="blog-program-cta" aria-labelledby="program-cta-title">
              <span>CHECK BEFORE YOU GO</span>
              <h2 id="program-cta-title">{post.programName}</h2>
              <p>동네고고 등록 상태는 <strong>{post.programStatus}</strong>입니다. 잔여석과 당일 운영 정보는 공식 안내에서 최종 확인해 주세요.</p>
              <div className="blog-program-cta__actions">
                <a href={post.officialUrl} target="_blank" rel="external nofollow noopener noreferrer" referrerPolicy="no-referrer">공식 안내 확인 <span aria-hidden="true">↗</span></a>
                <Link href={programPath}>동네고고 프로그램 보기</Link>
                <Link href="/web">지도에서 주변 찾기</Link>
              </div>
            </aside>

            <p className="blog-source-note">
              <strong>정보 출처</strong> {post.sourceName} · {post.sourceCheckedAt} 확인. 본문은 공개된 사실 정보를 바탕으로 동네고고 편집팀이 새로 작성했으며 원문을 복제하지 않았습니다. 일정·비용·접수 상태는 운영기관 사정에 따라 변경될 수 있습니다.
            </p>
            <div className="blog-tags" aria-label="관련 검색어">{post.tags.map((tag) => <span key={tag}>#{tag.replaceAll(" ", "")}</span>)}</div>
          </div>
        </article>

        <aside className="blog-next">
          <span>NEXT STORY</span>
          <Link href={`/blog/${nextPost.slug}`}>
            <h2>{nextPost.title}</h2>
            <i aria-hidden="true">→</i>
          </Link>
        </aside>
      </main>
      <footer className="blog-footer">
        <div><strong>동네고고</strong><span>우리 동네의 새로운 하루</span></div>
        <nav aria-label="블로그 하단 메뉴"><Link href="/">홈</Link><Link href="/blog">블로그</Link><Link href="/blog/about">편집 원칙</Link><a href="/blog/rss.xml">RSS</a></nav>
        <p>© 2026 DongNeGoGo. 가까운 공공 프로그램을 쉽고 정확하게 소개합니다.</p>
      </footer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
