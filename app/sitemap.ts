import type { MetadataRoute } from "next";

import { BLOG_POSTS } from "@/lib/blog-posts";

const routes = [
  "",
  "/terms",
  "/privacy",
  "/location-terms",
  "/public-data",
  "/account-deletion",
  "/blog",
  "/blog/about",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-25T00:00:00+09:00");

  const staticRoutes: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `https://www.dongnegogo.com${route}`,
    lastModified,
    changeFrequency: route === "" || route === "/blog" ? "daily" : "monthly",
    priority: route === "" ? 1 : route === "/blog" ? 0.9 : 0.7,
  }));

  const blogRoutes: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `https://www.dongnegogo.com/blog/${post.slug}`,
    lastModified: new Date(post.modifiedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...blogRoutes];
}
