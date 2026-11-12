import type { MetadataRoute } from "next";

const BASE = "https://tsg-map.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/city", "/city/data", "/methodology"].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
