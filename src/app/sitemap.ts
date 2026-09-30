import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const [genres, topics] = await Promise.all([
    prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }),
    // 複数媒体が報じたトピックのみ（単独記事のトピックは noindex）
    prisma.topic.findMany({
      where: { publisherCount: { gte: 2 }, lastSeenAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      orderBy: { lastSeenAt: "desc" },
      take: 5000,
      select: { id: true, lastSeenAt: true },
    }),
  ]);
  return [
    { url: base, changeFrequency: "always", priority: 1 },
    { url: `${base}/ranking`, changeFrequency: "hourly", priority: 0.8 },
    ...genres.map((g) => ({ url: `${base}/genre/${g.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...topics.map((t) => ({ url: `${base}/topic/${t.id}`, lastModified: t.lastSeenAt, priority: 0.6 })),
    { url: `${base}/sources`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
