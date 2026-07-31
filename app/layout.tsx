import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "동네고고 | 우리 동네 프로그램 지도",
  description: "내 주변의 교육, 문화, 체육, 복지 프로그램을 지도에서 한눈에 찾아보세요.",
  applicationName: "동네고고",
  keywords: ["동네고고", "공공프로그램", "문화센터", "평생교육", "서울"],
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "동네고고 | 우리 동네 프로그램 지도",
    description: "멀리 찾지 말고, 우리 동네에서 바로 시작해요.",
    locale: "ko_KR", type: "website", images: ["/og.png"],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
