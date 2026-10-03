import type { MetadataRoute } from "next";
import { FEATURE_KINDS, featurePath, jstMonth } from "@/lib/features";
import { recentWeeks } from "@/lib/weekly";
import { isIndexableArticle, jsonLength } from "@/lib/indexing";
import { siteConfig } from "@/config/site";
import { companyPath } from "@/lib/company";
import { prisma } from "@/lib/db";
import { getTagTopics, getTopCompanies } from "@/lib/queries";
import { COUNTRIES, TEAMS, tagPath } from "@/lib/tags";
import { listIndexableWorks, workPath } from "@/lib/works";
import { listIndexableOutlets, outletPath } from "@/lib/outlet";
import { archiveMonths, recentDays } from "@/lib/archive";
import { YOUTUBE_CHANNELS } from "@/lib/youtube-channels";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const [genres, topics, digests, companies] = await Promise.all([
    prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }),
    // AI まとめ記事があるトピックのみ（それ以外のトピックは noindex）
    prisma.topic.findMany({
      // 別の話題にまとめたページ（まとめた先へ移す）は載せない。登録の基準は話題のページと同じ（src/lib/indexing.ts）
      // 報道機関の記事がある話題だけ（企業の発表だけの話題は登録しない）
      where: { aiGeneratedAt: { not: null }, mergedIntoId: null, articles: { some: { source: { kind: "NEWS" } } } },
      orderBy: { aiGeneratedAt: "desc" },
      take: 8000,
      select: { id: true, aiGeneratedAt: true, publisherCount: true, aiAngles: true, aiBackground: true },
    }),
    // 定時配信の回（投稿済みのもの）
    prisma.edition.findMany({
      where: { status: "PUBLISHED", slot: { notIn: ["BREAKING", "PICKUP"] } },
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
  // 作品ページ（ゲームの発売日・アニメの放送日）。話題が2件以上か、まとめ記事のある作品だけ
  const works = await listIndexableWorks();
  // 媒体ごとの報道データ（直近の記録が十分にある媒体だけ）
  const outlets = await listIndexableOutlets();
  return [
    { url: base, changeFrequency: "always", priority: 1 },
    { url: `${base}/articles`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/trending`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/ranking`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/digest`, changeFrequency: "hourly", priority: 0.8 },
    ...digests.map((d) => ({ url: `${base}/digest/${d.date}/${d.slot.toLowerCase()}`, lastModified: d.publishedAt ?? undefined, priority: 0.7 })),
    { url: `${base}/calendar`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/compare`, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/prices`, changeFrequency: "daily", priority: 0.7 },
    ...recentWeeks(8).map((w) => ({ url: `${base}/weekly/${w}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...recentWeeks(8).map((w) => ({ url: `${base}/data/${w}`, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${base}/feature`, changeFrequency: "daily", priority: 0.7 },
    ...[jstMonth(), jstMonth(new Date(), 1)].flatMap((m) =>
      FEATURE_KINDS.map((k) => ({ url: `${base}${featurePath(k, m)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ),
    { url: `${base}/company`, changeFrequency: "daily", priority: 0.6 },
    ...companies.map((c) => ({ url: `${base}${companyPath(c.name)}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ...tags.map((t) => ({ url: `${base}${tagPath(t)}`, changeFrequency: "daily" as const, priority: 0.5 })),
    { url: `${base}/daily`, changeFrequency: "daily", priority: 0.6 },
    ...recentDays(90).map((d, i) => ({ url: `${base}/daily/${d}`, changeFrequency: (i === 0 ? "hourly" : "weekly") as "hourly" | "weekly", priority: 0.6 })),
    ...archiveMonths().flatMap((m) => [
      { url: `${base}/archive/${m}`, changeFrequency: "daily" as const, priority: 0.5 },
      ...genres.map((g) => ({ url: `${base}/archive/${m}/${g.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ]),
    { url: `${base}/youtube`, changeFrequency: "hourly", priority: 0.7 },
    ...YOUTUBE_CHANNELS.map((c) => ({ url: `${base}/youtube/${c.slug}`, changeFrequency: "hourly" as const, priority: 0.6 })),
    ...works.map((w) => ({ url: `${base}${workPath(w.kind, w.key)}`, changeFrequency: "daily" as const, priority: 0.6 })),
    ...genres.map((g) => ({ url: `${base}/genre/${g.slug}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...topics
      .filter((t) => isIndexableArticle({ publisherCount: t.publisherCount, hasAi: true, angles: jsonLength(t.aiAngles), background: jsonLength(t.aiBackground) }))
      .slice(0, 5000)
      .map((t) => ({ url: `${base}/topic/${t.id}`, lastModified: t.aiGeneratedAt ?? undefined, priority: 0.6 })),
    { url: `${base}/sources`, changeFrequency: "daily", priority: 0.5 },
    ...outlets.map((id) => ({ url: `${base}${outletPath(id)}`, changeFrequency: "daily" as const, priority: 0.5 })),
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
