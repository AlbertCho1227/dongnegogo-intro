import type { Metadata } from "next";
import Link from "next/link";

import { BlogHeader } from "@/components/blog-header";

export const metadata: Metadata = {
  title: "동네고고 블로그 편집·저작권 원칙",
  description: "동네고고 블로그가 프로그램 정보를 확인하고 원문을 복제하지 않으며 이미지 저작권을 보호하는 방법을 안내합니다.",
  alternates: { canonical: "/blog/about" },
};

export default function BlogAboutPage() {
  return (
    <div className="blog-site">
      <BlogHeader />
      <main className="blog-policy">
        <nav className="blog-breadcrumbs" aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><Link href="/blog">블로그</Link><span>/</span><span>편집 원칙</span></nav>
        <span className="blog-eyebrow">EDITORIAL POLICY</span>
        <h1>확인하고, 쉽게 쓰고,<br />바뀌면 바로잡습니다.</h1>
        <p className="blog-policy__intro">동네고고 블로그는 검색 노출을 위한 글의 양보다, 실제로 프로그램을 고르고 신청하는 데 도움이 되는 정보의 정확성과 가독성을 우선합니다.</p>

        <section>
          <h2>1. 사실 정보와 편집 문장을 구분합니다</h2>
          <p>프로그램명, 지역, 장소, 기간, 비용, 접수 상태는 동네고고에 수집된 공개 데이터와 운영기관 안내를 기준으로 확인합니다. 관람 포인트, 비교 방법, 준비 체크리스트는 독자가 더 나은 결정을 하도록 동네고고 편집팀이 새로 작성합니다.</p>
        </section>
        <section>
          <h2>2. 다른 사이트의 소개 글을 복제하지 않습니다</h2>
          <p>원문의 문단이나 표현을 옮겨 붙이지 않습니다. 사실에 해당하는 짧은 정보만 추출하고, 출처를 표시한 뒤 동네고고의 관점과 구조로 다시 씁니다. 인용이 꼭 필요한 경우에도 최소한으로 사용하고 출처 링크를 함께 제공합니다.</p>
        </section>
        <section>
          <h2>3. 이미지 사용 권리를 먼저 확인합니다</h2>
          <p>기본적으로 동네고고가 직접 보유한 브랜드 이미지와 분류 아이콘을 사용합니다. 외부 사진이나 포스터는 재사용 조건이 명확한 경우에만 출처와 이용 조건을 표시해 사용합니다. 권리가 불명확하면 이미지 없이도 읽기 좋은 자체 비주얼로 대체합니다.</p>
        </section>
        <section>
          <h2>4. AI는 보조 도구로 사용하고 사람이 책임집니다</h2>
          <p>자료 정리와 초안 작성에 AI 도구가 활용될 수 있습니다. 게시 전에는 날짜, 지역, 대상, 비용, 링크를 다시 확인하고 과장되거나 근거 없는 표현을 제거합니다. 자동 생성물을 검토 없이 대량 발행하지 않습니다.</p>
        </section>
        <section>
          <h2>5. 변경 가능성을 눈에 보이게 알립니다</h2>
          <p>각 글에는 정보 확인일과 공식 안내 링크를 표시합니다. 접수 상태, 잔여석, 운영시간, 비용은 게시 뒤 바뀔 수 있으므로 최종 신청 전 운영기관 안내를 확인하도록 안내합니다. 중요한 오류 제보가 확인되면 수정일을 갱신합니다.</p>
        </section>
        <section>
          <h2>6. 지난 프로그램도 기록으로 보존합니다</h2>
          <p>행사나 접수 기간이 끝났다는 이유만으로 글을 삭제하지 않습니다. 종료 상태를 분명히 표시하고 다음 모집을 비교할 수 있는 지역 기록으로 남깁니다. 다만 주차장 정보는 블로그 발행 대상에서 제외합니다.</p>
        </section>
        <section>
          <h2>문의와 정정</h2>
          <p>프로그램 운영기관 또는 권리자가 정보·이미지의 정정이나 삭제를 요청하는 경우 확인 후 신속히 반영합니다. 현재 공식 문의 채널이 준비 중이며, 그 전까지는 각 프로그램의 운영기관 안내를 최종 기준으로 봐 주세요.</p>
        </section>
      </main>
      <footer className="blog-footer">
        <div><strong>동네고고</strong><span>우리 동네의 새로운 하루</span></div>
        <nav aria-label="블로그 하단 메뉴"><Link href="/">홈</Link><Link href="/blog">블로그</Link><Link href="/public-data">공공데이터 정책</Link></nav>
        <p>© 2026 DongNeGoGo.</p>
      </footer>
    </div>
  );
}
