import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [
      "https://www.dongnegogo.com/sitemap.xml",
      "https://www.dongnegogo.com/blog/sitemap-index.xml",
    ],
    host: "https://www.dongnegogo.com",
  };
}
