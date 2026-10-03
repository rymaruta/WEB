import { prisma } from "@/lib/db";
import { firstReporter, minutesToReach, numberDiffs, reportsWithin, spreadCurve, type CoverageArticle, type NumberDiff } from "@/lib/coverage";
import { publisherLabel } from "@/lib/publisher";
import { weekRange } from "@/lib/weekly";

/**
 * 今週の報道データ。1週間（月曜〜日曜、日本時間）に最初に報じられた出来事について、
 * 「何社が・どれだけ速く・どう報じたか」をこのサイトが集めた記録から数える（AI は使わない。数えるだけ）。
 * 媒体の数は転載・再配信を除いた独立した報道の数
 */

const MAX_TOPICS = 1500;

export type ReportTopic = { id: number; title: string; genre: string; publishers: number; within1h: number; to5: number | null; first: string | null };

export type WeekReport = {
  articles: number;
  outlets: number;
  topics2: number;
  topics3: number;
  top: ReportTopic[];
  fastest: ReportTopic[];
  firsts: { publisher: string; count: number }[];
  firstsTotal: number;
  genres: { name: string; slug: string; topics: number; reports: number }[];
  splits: { id: number; title: string; diffs: NumberDiff[] }[];
};

export async function getWeekReport(week: string): Promise<WeekReport | null> {
  const r = weekRange(week);
  if (!r) return null;
  const range = { gte: r.start, lt: r.end };
  const [topics, articles, outlets] = await Promise.all([
    prisma.topic.findMany({
      where: { firstSeenAt: range, mergedIntoId: null, aiNotNews: false, publisherCount: { gte: 2 } },
      orderBy: [{ publisherCount: "desc" }, { score: "desc" }],
      take: MAX_TOPICS,
      select: {
        id: true,
        title: true,
        aiTitle: true,
        publisherCount: true,
        genre: { select: { slug: true, name: true } },
        articles: { select: { id: true, publisher: true, publishedAt: true, title: true, source: { select: { kind: true } } } },
      },
    }),
    prisma.article.count({ where: { publishedAt: range, source: { kind: "NEWS" } } }),
    prisma.article.groupBy({ by: ["publisher"], where: { publishedAt: range, source: { kind: "NEWS" } } }).then((g) => g.length),
  ]);
  if (topics.length === 0) return null;

  const rows = topics.map((t) => {
    const cov: CoverageArticle[] = t.articles.map((a) => ({ id: a.id, publisher: a.publisher, publishedAt: a.publishedAt, title: a.title, kind: a.source.kind }));
    const spread = spreadCurve(cov);
    const first = firstReporter(cov);
    const row: ReportTopic = {
      id: t.id,
      title: t.aiTitle ?? t.title,
      genre: t.genre.name,
      publishers: t.publisherCount,
      within1h: reportsWithin(spread, 60),
      to5: minutesToReach(spread, 5),
      first: first ? publisherLabel(first) : null,
    };
    return { row, cov, genre: t.genre };
  });

  const firstCounts = new Map<string, number>();
  for (const { row } of rows) if (row.first) firstCounts.set(row.first, (firstCounts.get(row.first) ?? 0) + 1);
  const genreMap = new Map<string, { name: string; slug: string; topics: number; reports: number }>();
  for (const { row, genre } of rows) {
    const g = genreMap.get(genre.slug) ?? { name: genre.name, slug: genre.slug, topics: 0, reports: 0 };
    g.topics++;
    g.reports += row.publishers;
    genreMap.set(genre.slug, g);
  }

  return {
    articles,
    outlets,
    topics2: rows.length,
    topics3: rows.filter((x) => x.row.publishers >= 3).length,
    top: rows.slice(0, 10).map((x) => x.row),
    fastest: rows
      .filter((x) => x.row.to5 !== null)
      .sort((a, b) => a.row.to5! - b.row.to5! || b.row.publishers - a.row.publishers)
      .slice(0, 5)
      .map((x) => x.row),
    firsts: [...firstCounts].map(([publisher, count]) => ({ publisher, count })).sort((a, b) => b.count - a.count || a.publisher.localeCompare(b.publisher)).slice(0, 10),
    firstsTotal: [...firstCounts.values()].reduce((a, b) => a + b, 0),
    genres: [...genreMap.values()].sort((a, b) => b.reports - a.reports),
    splits: rows
      .map((x) => ({ id: x.row.id, title: x.row.title, diffs: numberDiffs(x.cov, publisherLabel) }))
      .filter((x) => x.diffs.length > 0)
      .slice(0, 8),
  };
}
