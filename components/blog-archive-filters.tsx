"use client";

import { useRef } from "react";

import { BLOG_ARCHIVE_CITIES, type BlogArchiveCity } from "@/lib/blog-archive-regions";

export function BlogArchiveFilters({ category, city, searchTerm }: {
  category: string;
  city: BlogArchiveCity;
  searchTerm: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} className="blog-filter-actions" action="/blog">
      <label className="blog-city-select" htmlFor="blog-city-select">
        <span>도시 선택 :</span>
        <select id="blog-city-select" name="city" defaultValue={city} onChange={() => formRef.current?.requestSubmit()}>
          {BLOG_ARCHIVE_CITIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <div className="blog-search">
        <span aria-hidden="true">⌕</span>
        <label className="sr-only" htmlFor="blog-program-search">프로그램 글 검색</label>
        <input id="blog-program-search" name="q" type="search" defaultValue={searchTerm} placeholder="지역, 공연, 수영, 강좌 검색" />
        <button type="submit">검색</button>
      </div>
      {category !== "전체" && <input type="hidden" name="category" value={category} />}
    </form>
  );
}
