import type { MetadataRoute } from "next";
import { FEATURE_KINDS, featurePath, jstMonth } from "@/lib/features";
import { recentWeeks } from "@/lib/weekly";
import { isIndexableArticle, jsonLength } from "@/lib/indexing";
import { siteConfig } from "@/config/site";
import { companyPath } from "@/lib/company";
import { prisma } from "@/lib/db";
import { getTagTopics, getTopCompanies } from "@/lib/queries";
import { COUNTRIES, TEAMS, tagPath } from "@/lib/tags";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const [genres, topics, digests, companies] = await Promise.all([
    prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }),
    // AI まとめ記事があるトピックのみ（それ以外のトピックは noindex）
    prisma.topic.findMany({
      // 別の話題にまとめたページ（まとめた先へ移す）は載せない。登録の基準は話題のページと同じ（src/lib/indexing.ts）
      where: { aiGeneratedAt: { not: null }, mergedIntoId: null },
      orderBy: { aiGeneratedAt: "desc" },
      take: 8000,
      select: { id: true, aiGeneratedAt: true, publisherCount: true, aiAngles: true, aiBackground: true },
    }),
    // 定時配信の回（投稿済みのもの）
    prisma.edition.findMany({
      where: { status: "PUBLISHED", slot: { not: "BREAKING" } },
      orderBy: { scheduledAt: "desc" },
      take: 3000,
      select: { date: true, slot: true, publishedAt: true },
    }),
    // 企業ページは話題が2件以上あるもの（1件のページは noindex）
    getTopCompanies(90, 1000, 2),
  ]);
  // 国別・チーム別のページは、話題が2件以上あるもの（1件のページは noindex）
  const tags = (
    await Promise.all([...COUNTRIES, ...TEAMS].map(async (t) => ((await getTagTopics(t, 0, 1)).total >= 2 ? [t] : [])))
  ).flat();
  return [
    { url: base, changeFrequency: "always", priority: 1 },
    { url: `${base}/articles`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/ranking`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/digest`, changeFrequency: "hourly", priority: 0.8 },
    ...digests.map((d) => ({ url: `${base}/digest/${d.date}/${d.slot.toLowerCase()}`, lastModified: d.publishedAt ?? undefined, priority: 0.7 })),
    { url: `${base}/calendar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/compare`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/prices`, changeFrequency: "daily", priority: 0.7 },
    ...recentWeeks(8).map((w) => ({ url: `${base}/weekly/${w}`, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${base}/feature`, changeFrequency: "daily", priority: 0.7 },
    ...[jstMonth(), jstMonth(new Date(), 1)].flatMap((m) =>
      FEATURE_KINDS.map((k) => ({ url: `${base}${featurePath(k, m)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ),
    { url: `${base}/company`, changeFrequency: "daily", priority: 0.6 },
    ...companies.map((c) => ({ url: `${base}${companyPath(c.name)}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...tags.map((t) => ({ url: `${base}${tagPath(t)}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...genres.map((g) => ({ url: `${base}/genre/${g.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...topics
      .filter((t) => isIndexableArticle({ publisherCount: t.publisherCount, hasAi: true, angles: jsonLength(t.aiAngles), background: jsonLength(t.aiBackground) }))
      .slice(0, 5000)
      .map((t) => ({ url: `${base}/topic/${t.id}`, lastModified: t.aiGeneratedAt ?? undefined, priority: 0.6 })),
    { url: `${base}/sources`, changeFrequency: "weekly", priority: 0.3 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
