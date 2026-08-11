import type { MetadataRoute } from "next";

const routes = [
  "",
  "/terms",
  "/privacy",
  "/location-terms",
  "/public-data",
  "/account-deletion",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-11T00:00:00+09:00");

  return routes.map((route) => ({
    url: `https://www.dongnegogo.com${route}`,
    lastModified,
    changeFrequency: route === "" ? "daily" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
