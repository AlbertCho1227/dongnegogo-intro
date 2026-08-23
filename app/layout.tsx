import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./legal.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dongnegogo.com"),
  title: "동네고고 | 우리 동네의 새로운 하루",
  description: "교육, 문화, 체육, 전시와 공공 혜택을 가까운 곳부터 쉽고 빠르게 찾는 동네 생활 정보 서비스입니다.",
  applicationName: "동네고고",
  keywords: ["동네고고", "공공프로그램", "문화센터", "평생교육", "생활체육", "문화행사"],
  verification: {
    other: {
      "naver-site-verification": "645fbd3189250f6faed6a20e675b4a23b113c02b",
    },
  },
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "https://www.dongnegogo.com/blog/rss.xml" },
  },
  icons: { icon: "/brand/app-icon.png", apple: "/brand/app-icon.png" },
  openGraph: {
    title: "동네고고 | 우리 동네의 새로운 하루",
    description: "우리 동네의 배움과 즐거움을 가까운 곳부터 쉽게 찾아보세요.",
    locale: "ko_KR", type: "website", siteName: "동네고고",
    images: [{ url: "https://www.dongnegogo.com/og.png", width: 1731, height: 909, alt: "동네고고 서비스 소개" }],
  },
  twitter: { card: "summary_large_image", title: "동네고고 | 우리 동네의 새로운 하루", description: "우리 동네의 배움과 즐거움을 한곳에서", images: ["https://www.dongnegogo.com/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
