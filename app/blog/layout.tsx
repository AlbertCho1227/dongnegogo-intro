import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./blog.css";

export const metadata: Metadata = {
  title: {
    default: "동네고고 블로그 | 가까운 교육·문화·체육 프로그램 이야기",
    template: "%s",
  },
  description: "전국의 교육, 강좌, 공연, 체육, 문화, 예술, 전시와 행사를 지역별로 쉽게 풀어 소개하는 동네고고 공식 블로그입니다.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "https://www.dongnegogo.com/blog/rss.xml" },
  },
  openGraph: {
    title: "동네고고 블로그",
    description: "오늘 참여할 수 있는 우리 동네 프로그램을 쉽고 정확하게 소개합니다.",
    url: "https://www.dongnegogo.com/blog",
    siteName: "동네고고",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "https://www.dongnegogo.com/blog/og.png", width: 1536, height: 1024, alt: "동네고고 블로그" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "동네고고 블로그",
    description: "가까운 교육·문화·체육 프로그램을 놓치지 마세요.",
    images: ["https://www.dongnegogo.com/blog/og.png"],
  },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}

