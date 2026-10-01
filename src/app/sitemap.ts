import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const [genres, topics, digests] = await Promise.all([
    prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }),
    // AI まとめ記事があるトピックのみ（それ以外のトピックは noindex）
    prisma.topic.findMany({
      where: { aiGeneratedAt: { not: null } },
      orderBy: { aiGeneratedAt: "desc" },
      take: 5000,
      select: { id: true, aiGeneratedAt: true },
    }),
    // 定時配信の回（投稿済みのもの）
    prisma.edition.findMany({
      where: { status: "PUBLISHED", slot: { not: "BREAKING" } },
      orderBy: { scheduledAt: "desc" },
      take: 3000,
      select: { date: true, slot: true, publishedAt: true },
    }),
  ]);
  return [
    { url: base, changeFrequency: "always", priority: 1 },
    { url: `${base}/articles`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/ranking`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/digest`, changeFrequency: "hourly", priority: 0.8 },
    ...digests.map((d) => ({ url: `${base}/digest/${d.date}/${d.slot.toLowerCase()}`, lastModified: d.publishedAt ?? undefined, priority: 0.7 })),
    ...genres.map((g) => ({ url: `${base}/genre/${g.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...topics.map((t) => ({ url: `${base}/topic/${t.id}`, lastModified: t.aiGeneratedAt ?? undefined, priority: 0.6 })),
    { url: `${base}/sources`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
