"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function archiveHref(page: number, category: string, city: string, query: string): string {
  const params = new URLSearchParams();
  if (category !== "전체") params.set("category", category);
  if (city !== "전체") params.set("city", city);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/blog?${suffix}#program-archive-title` : "/blog#program-archive-title";
}

function visiblePages(page: number, totalPages: number): number[] {
  return [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
}

export function BlogPagination({ page, totalPages, category, city, searchTerm }: {
  page: number;
  totalPages: number;
  category: string;
  city: string;
  searchTerm: string;
}) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState("");
  const pages = visiblePages(page, totalPages);
  const previousHref = page > 1 ? archiveHref(page - 1, category, city, searchTerm) : "";
  const nextHref = page < totalPages ? archiveHref(page + 1, category, city, searchTerm) : "";

  useEffect(() => {
    // 현재 화면을 먼저 그린 뒤 양옆 페이지를 준비해 실제 클릭 대기 시간을 없앱니다.
    const prefetchAdjacent = () => {
      if (previousHref) router.prefetch(previousHref);
      if (nextHref) router.prefetch(nextHref);
    };
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(prefetchAdjacent, { timeout: 800 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(prefetchAdjacent, 120);
    return () => window.clearTimeout(timer);
  }, [nextHref, previousHref, router]);

  const warm = (href: string) => router.prefetch(href);
  const begin = (href: string) => setPendingHref(href);
  const linkState = (href: string, active = false) => `${active ? "is-active" : ""}${pendingHref === href ? " is-loading" : ""}`.trim() || undefined;

  return <nav className="blog-pagination" aria-label="프로그램 글 페이지" aria-busy={Boolean(pendingHref)}>
    <span className="blog-pagination__edge-slot blog-pagination__edge-slot--previous">{previousHref && <Link className={linkState(previousHref, false) ? `blog-pagination__edge ${linkState(previousHref)}` : "blog-pagination__edge"} href={previousHref} prefetch={false} onMouseEnter={() => warm(previousHref)} onFocus={() => warm(previousHref)} onClick={() => begin(previousHref)}>← 이전</Link>}</span>
    <div>{pages.map((item, index) => {
      const href = archiveHref(item, category, city, searchTerm);
      return <span key={item}>{index > 0 && item - pages[index - 1] > 1 && <i aria-hidden="true">…</i>}<Link className={linkState(href, item === page)} aria-current={item === page ? "page" : undefined} href={href} prefetch={false} onMouseEnter={() => warm(href)} onFocus={() => warm(href)} onClick={() => begin(href)}>{item.toLocaleString("ko-KR")}</Link></span>;
    })}</div>
    <span className="blog-pagination__edge-slot blog-pagination__edge-slot--next">{nextHref && <Link className={linkState(nextHref, false) ? `blog-pagination__edge ${linkState(nextHref)}` : "blog-pagination__edge"} href={nextHref} prefetch={false} onMouseEnter={() => warm(nextHref)} onFocus={() => warm(nextHref)} onClick={() => begin(nextHref)}>다음 →</Link>}</span>
  </nav>;
}
