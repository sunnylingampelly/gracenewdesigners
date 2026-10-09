import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private, transactional and duplicate-prone URLs.
        disallow: ["/admin", "/api/", "/backend/", "/bag", "/wishlist", "/enquiry/", "/search", "/*?*sort=", "/gone"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
