import { getBlogProgramPage } from "@/lib/blog-program-data";

const URLS_PER_SITEMAP = 1_000;

export async function GET() {
  const { total } = await getBlogProgramPage(0, 1).catch(() => ({ programs: [], total: 0 }));
  const count = Math.ceil(total / URLS_PER_SITEMAP);
  const today = new Date().toISOString();
  const entries = Array.from({ length: count }, (_, index) => `<sitemap><loc>https://www.dongnegogo.com/blog/sitemaps/programs/${index + 1}</loc><lastmod>${today}</lastmod></sitemap>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
