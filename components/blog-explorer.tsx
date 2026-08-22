"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { BlogPost } from "@/lib/blog-posts";
import { koreanDate } from "@/lib/blog-posts";

const CATEGORIES = ["전체", "교육", "문화·전시", "체육"] as const;

type BlogExplorerProps = {
  posts: BlogPost[];
};

export function BlogExplorer({ posts }: BlogExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("전체");
  const filtered = useMemo(() => {
    const normalized = query.normalize("NFC").trim().toLocaleLowerCase("ko-KR");
    return posts.filter((post) => {
      if (category !== "전체" && post.category !== category) return false;
      if (!normalized) return true;
      return [post.title, post.description, post.region, post.audience, ...post.tags]
        .join(" ")
        .normalize("NFC")
        .toLocaleLowerCase("ko-KR")
        .includes(normalized);
    });
  }, [category, posts, query]);

  return (
    <section className="blog-explorer" aria-labelledby="latest-posts-title">
      <div className="blog-section-heading">
        <div>
          <span className="blog-eyebrow">LATEST STORIES</span>
          <h2 id="latest-posts-title">지금 읽기 좋은 동네 이야기</h2>
        </div>
        <p>지역과 관심사를 골라 내게 필요한 프로그램만 빠르게 찾아보세요.</p>
      </div>

      <div className="blog-tools">
        <div className="blog-chips" role="group" aria-label="카테고리 필터">
          {CATEGORIES.map((item) => (
            <button
              type="button"
              key={item}
              className={category === item ? "is-active" : undefined}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="blog-search">
          <span className="sr-only">블로그 검색</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="지역, 강좌, 전시 검색"
          />
        </label>
      </div>

      <p className="blog-result-count" aria-live="polite">{filtered.length}개의 이야기를 찾았어요</p>
      {filtered.length ? (
        <div className="blog-card-grid">
          {filtered.map((post) => (
            <article className={`blog-card blog-accent--${post.accent}`} key={post.slug}>
              <Link className="blog-card__visual" href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">
                <span className="blog-card__orb" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.iconPath} alt="" width="88" height="88" />
                <span className="blog-card__region">{post.region}</span>
              </Link>
              <div className="blog-card__body">
                <div className="blog-card__meta">
                  <span>{post.category}</span>
                  <time dateTime={post.publishedAt}>{koreanDate(post.publishedAt)}</time>
                  <span>{post.readingMinutes}분</span>
                </div>
                <h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3>
                <p>{post.description}</p>
                <div className="blog-card__footer">
                  <span>{post.programStatus}</span>
                  <Link href={`/blog/${post.slug}`} aria-label={`${post.title} 읽기`}>읽어보기 <span aria-hidden="true">→</span></Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="blog-empty">
          <strong>일치하는 이야기가 없어요.</strong>
          <p>검색어를 줄이거나 다른 카테고리를 선택해 보세요.</p>
        </div>
      )}
    </section>
  );
}

