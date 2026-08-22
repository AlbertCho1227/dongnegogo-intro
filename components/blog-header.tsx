import Link from "next/link";

export function BlogHeader() {
  return (
    <header className="blog-header">
      <div className="blog-header__inner">
        <Link className="blog-brand" href="/" aria-label="동네고고 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/app-icon.png" alt="" width="38" height="38" />
          <span>동네고고</span>
          <em>블로그</em>
        </Link>
        <nav className="blog-nav" aria-label="주요 메뉴">
          <Link href="/">서비스 소개</Link>
          <Link href="/web">지도에서 찾기</Link>
          <Link className="is-current" href="/blog" aria-current="page">블로그</Link>
        </nav>
      </div>
    </header>
  );
}

