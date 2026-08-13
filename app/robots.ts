import type { MetadataRoute } from "next";

const APP_URL = "https://app.prepiq.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/workspace/", "/setup/", "/impersonate/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}