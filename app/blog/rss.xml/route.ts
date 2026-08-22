import { BLOG_POSTS, blogPostUrl } from "@/lib/blog-posts";

export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function fullText(post: (typeof BLOG_POSTS)[number]): string {
  const sections = post.sections.map((section) => {
    const paragraphs = section.paragraphs.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join("");
    const bullets = section.bullets?.length
      ? `<ul>${section.bullets.map((bullet) => `<li>${escapeXml(bullet)}</li>`).join("")}</ul>`
      : "";
    return `<h2>${escapeXml(section.heading)}</h2>${paragraphs}${bullets}`;
  }).join("");
  return `${post.intro.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join("")}${sections}<p><strong>출처:</strong> ${escapeXml(post.sourceName)} · ${escapeXml(post.sourceCheckedAt)} 확인</p>`;
}

export function GET() {
  const items = BLOG_POSTS.map((post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${blogPostUrl(post)}</link>
      <guid isPermaLink="true">${blogPostUrl(post)}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <description>${escapeXml(post.description)}</description>
      <content:encoded><![CDATA[${fullText(post).replaceAll("]]>", "]]]]><![CDATA[>")}]]></content:encoded>
    </item>`).join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>동네고고 블로그</title>
    <link>https://www.dongnegogo.com/blog</link>
    <description>전국의 교육·문화·체육 프로그램을 쉽게 소개하는 동네고고 공식 블로그</description>
    <language>ko-KR</language>
    <lastBuildDate>${new Date(BLOG_POSTS[0].modifiedAt).toUTCString()}</lastBuildDate>
    <generator>DongNeGoGo Editorial</generator>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

