import type { MetadataRoute } from "next";

const APP_URL = "https://app.prepiq.com";

// Only pages reachable without an authenticated session belong in the sitemap.
// Everything under /workspace and /setup is behind login and 307s to /login,
// so listing it would only waste crawl budget.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/register`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${APP_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}