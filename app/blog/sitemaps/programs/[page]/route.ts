import { isParkingProgram } from "@/lib/blog-program";
import { getBlogProgramPage } from "@/lib/blog-program-data";

const URLS_PER_SITEMAP = 1_000;

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page: rawPage } = await params;
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > 200) return new Response("Not found", { status: 404 });
  const { programs, total } = await getBlogProgramPage((page - 1) * URLS_PER_SITEMAP, URLS_PER_SITEMAP).catch(() => ({ programs: [], total: 0 }));
  if (!programs.length && (page > 1 || total === 0)) return new Response("Not found", { status: 404 });
  const entries = programs
    .filter((program) => !isParkingProgram(program) && program.imageUrl && program.area && program.facility && program.source && (program.lectureStart || program.periodText || program.receiptEnd))
    .map((program) => {
      const loc = `https://www.dongnegogo.com/blog/program/${encodeURIComponent(program.id)}`;
      const lastmod = program.updatedAt ? `<lastmod>${xml(program.updatedAt)}</lastmod>` : "";
      return `<url><loc>${xml(loc)}</loc>${lastmod}<changefreq>monthly</changefreq><priority>0.7</priority></url>`;
    }).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
