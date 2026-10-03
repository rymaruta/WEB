import { AGGREGATORS, coverageTimes, originalReports, type CoverageArticle } from "@/lib/coverage";
import { prisma } from "@/lib/db";

/**
 * 媒体ごとの報道データ。このサイトが同じ時間に多くの媒体を集めているから数えられる記録（AI は使わない。数えるだけ）。
 * - 報道機関: いつ・何を・どれだけ報じたか、3社以上が報じた出来事で何番目・何分後に報じたか
 * - 発表（官公庁・企業）: 発表のうち、報道機関が報じたものの割合と、報じられるまでの時間
 */

export const OUTLET_DAYS = 30;
/** 速さを比べる出来事の条件（独立した報道の数）。src/lib/indexing.ts の登録の基準と同じ */
const COMPARE_MIN_PUBLISHERS = 3;
/** 検索エンジンに登録するページの条件（数える記録が少ない媒体のページは登録しない） */
export const OUTLET_INDEX_MIN = { NEWS: 20, PRESS: 10 } as const;
const MAX_OWN = 10_000;
const MAX_TOPICS = 1_500;

const DAY_MS = 86_400_000;
const JST_MS = 9 * 3_600_000;
/** 日本時間の日付（YYYY-MM-DD） */
const jstDay = (d: Date) => new Date(d.getTime() + JST_MS).toISOString().slice(0, 10);
const jstHour = (d: Date) => new Date(d.getTime() + JST_MS).getUTCHours();

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** 直近 days 日の日本時間の日付（古い順） */
export function recentJstDays(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, i) => jstDay(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
}

export type OwnArticle = { publishedAt: Date; genre: string };

/** 日ごと・時間帯ごと・ジャンルごとの本数 */
export function volumeStats(own: OwnArticle[], days: number, now = new Date()) {
  const dayKeys = recentJstDays(days, now);
  const perDay = new Map(dayKeys.map((d) => [d, 0]));
  const perHour = Array.from({ length: 24 }, () => 0);
  const perGenre = new Map<string, number>();
  for (const a of own) {
    const d = jstDay(a.publishedAt);
    if (perDay.has(d)) perDay.set(d, perDay.get(d)! + 1);
    perHour[jstHour(a.publishedAt)]++;
    perGenre.set(a.genre, (perGenre.get(a.genre) ?? 0) + 1);
  }
  return {
    daily: dayKeys.map((day) => ({ day, count: perDay.get(day)! })),
    hourly: perHour,
    genres: [...perGenre].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

export type OutletTopic = { id: number; title: string; publisherCount: number; articles: CoverageArticle[] };

export type RaceRow = { id: number; title: string; publishers: number; rank: number; minutes: number };

/**
 * 報道機関の速さ。独立した報道が3社以上の出来事で、この媒体が何番目・最初の報道から何分後に報じたか。
 * 転載を配信する媒体は比べない（元の報道より後になるため）
 */
export function raceStats(publisher: string, topics: OutletTopic[]) {
  if (AGGREGATORS.has(publisher)) return null;
  const rows: RaceRow[] = [];
  for (const t of topics) {
    const firsts = originalReports(t.articles).filter((a, i, all) => all.findIndex((b) => b.publisher === a.publisher) === i);
    if (firsts.length < COMPARE_MIN_PUBLISHERS) continue;
    const rank = firsts.findIndex((a) => a.publisher === publisher);
    if (rank < 0) continue;
    const times = coverageTimes(t.articles);
    const minutes = times.get(firsts[rank].id)?.minutes ?? 0;
    rows.push({ id: t.id, title: t.title, publishers: firsts.length, rank: rank + 1, minutes });
  }
  const behind = rows.filter((r) => r.rank > 1).map((r) => r.minutes);
  return {
    compared: rows.length,
    firsts: rows.filter((r) => r.rank === 1).length,
    within1h: rows.filter((r) => r.minutes <= 60).length,
    medianBehind: median(behind),
    /** 報じた媒体の多い出来事（大きな出来事での報じ方） */
    major: [...rows].sort((a, b) => b.publishers - a.publishers || a.minutes - b.minutes).slice(0, 10),
  };
}

export type Announcement = { id: number; title: string; url: string; publishedAt: Date; topic: OutletTopic | null };

export type AnnouncementRow = { id: number; title: string; url: string; publishedAt: Date; topicId: number | null; reporters: number; lag: number | null; before: boolean };

/** 時刻のない発表（日付だけで配信され、0時0分になっているもの）。報道までの時間は測れない */
const dateOnly = (d: Date) => new Date(d.getTime() + JST_MS).toISOString().slice(11, 16) === "00:00";

/**
 * 発表（官公庁・企業）が報じられたか。発表と同じ話題にまとまった報道機関の記事（転載を除く）の数と、
 * 発表から最初の報道までの時間（分）。発表より前の報道は「事前に報道」として分けて数える
 */
export function announcementStats(items: Announcement[]) {
  const rows: AnnouncementRow[] = items.map((a) => {
    const news = a.topic ? originalReports(a.topic.articles) : [];
    const reporters = new Set(news.map((n) => n.publisher)).size;
    const first = news[0];
    const before = !!first && first.publishedAt.getTime() < a.publishedAt.getTime() && !dateOnly(a.publishedAt);
    const lag = first && !before && !dateOnly(a.publishedAt) ? Math.round((first.publishedAt.getTime() - a.publishedAt.getTime()) / 60_000) : null;
    return { id: a.id, title: a.title, url: a.url, publishedAt: a.publishedAt, topicId: a.topic?.id ?? null, reporters, lag, before };
  });
  const reported = rows.filter((r) => r.reporters > 0);
  return {
    total: rows.length,
    reported: reported.length,
    before: reported.filter((r) => r.before).length,
    medianLag: median(reported.flatMap((r) => (r.lag === null ? [] : [r.lag]))),
    /** 報じた媒体の多い発表 */
    top: [...reported].sort((a, b) => b.reporters - a.reporters || b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 10),
    recent: [...rows].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 15),
  };
}

/** 媒体のページの番号（その媒体のフィードのうち、いちばん小さい番号）。媒体名は日本語なので URL には番号を使う */
export async function outletIds(): Promise<Map<string, number>> {
  const sources = await prisma.source.findMany({
    where: { active: true, kind: { not: "SOCIAL" } },
    orderBy: { id: "asc" },
    select: { id: true, publisher: true },
  });
  const out = new Map<string, number>();
  for (const s of sources) if (!out.has(s.publisher)) out.set(s.publisher, s.id);
  return out;
}

export const outletPath = (id: number) => `/sources/${id}`;

/** 検索エンジンに登録する媒体のページ（直近の記録が十分にある媒体）。サイトマップ用 */
export async function listIndexableOutlets(now = new Date()) {
  const sources = await prisma.source.findMany({
    where: { active: true, kind: { not: "SOCIAL" } },
    orderBy: { id: "asc" },
    select: { id: true, publisher: true, kind: true },
  });
  const counts = await prisma.article.groupBy({
    by: ["publisher", "sourceId"],
    where: { publishedAt: { gte: new Date(now.getTime() - OUTLET_DAYS * DAY_MS) }, sourceId: { in: sources.map((s) => s.id) } },
    _count: { _all: true },
  });
  const kindOf = new Map(sources.map((s) => [s.id, s.kind]));
  const ids = new Map<string, { id: number; kind: "NEWS" | "PRESS" | "SOCIAL"; total: number }>();
  for (const s of sources) if (!ids.has(s.publisher)) ids.set(s.publisher, { id: s.id, kind: s.kind, total: 0 });
  for (const c of counts) {
    const o = ids.get(c.publisher);
    // 媒体のページで数えるのは、代表のフィードと同じ種類のフィードの記事
    if (o && kindOf.get(c.sourceId) === o.kind) o.total += c._count._all;
  }
  return [...ids.values()].filter(isIndexableOutlet).map((o) => o.id);
}

/** 媒体のページの中身。番号が媒体の代表（いちばん小さい番号）でなければ null */
export async function getOutletProfile(id: number, now = new Date()) {
  const source = await prisma.source.findUnique({ where: { id }, select: { publisher: true, kind: true, siteUrl: true, active: true } });
  if (!source || !source.active || source.kind === "SOCIAL") return null;
  const ids = await outletIds();
  if (ids.get(source.publisher) !== id) return null;
  const publisher = source.publisher;
  const since = new Date(now.getTime() - OUTLET_DAYS * DAY_MS);
  const ownWhere = { publisher, source: { active: true, kind: source.kind }, publishedAt: { gte: since } };

  const [feeds, total, own] = await Promise.all([
    prisma.source.findMany({ where: { publisher, active: true }, select: { name: true, siteUrl: true }, orderBy: { id: "asc" } }),
    prisma.article.count({ where: ownWhere }),
    prisma.article.findMany({
      where: ownWhere,
      orderBy: { publishedAt: "desc" },
      take: MAX_OWN,
      select: { id: true, title: true, url: true, publishedAt: true, topicId: true, genre: { select: { name: true } } },
    }),
  ]);
  const volume = volumeStats(own.map((a) => ({ publishedAt: a.publishedAt, genre: a.genre.name })), OUTLET_DAYS, now);

  // 比べる出来事（報道機関は独立した報道3社以上、発表は報道機関が1社以上報じた話題）
  const topicIds = [...new Set(own.flatMap((a) => (a.topicId ? [a.topicId] : [])))];
  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds }, mergedIntoId: null, publisherCount: { gte: source.kind === "NEWS" ? COMPARE_MIN_PUBLISHERS : 1 } },
    orderBy: { publisherCount: "desc" },
    take: MAX_TOPICS,
    select: {
      id: true,
      title: true,
      aiTitle: true,
      publisherCount: true,
      articles: { select: { id: true, publisher: true, publishedAt: true, title: true, source: { select: { kind: true } } } },
    },
  });
  const byId = new Map<number, OutletTopic>(
    topics.map((t) => [
      t.id,
      {
        id: t.id,
        title: t.aiTitle ?? t.title,
        publisherCount: t.publisherCount,
        articles: t.articles.map((a) => ({ id: a.id, publisher: a.publisher, publishedAt: a.publishedAt, title: a.title, kind: a.source.kind })),
      },
    ]),
  );

  const base = { id, publisher, kind: source.kind, siteUrl: source.siteUrl, feeds, total, volume, days: OUTLET_DAYS };
  if (source.kind === "NEWS") return { ...base, race: raceStats(publisher, [...byId.values()]), announcements: null };
  const announcements = announcementStats(
    own.map((a) => ({ id: a.id, title: a.title, url: a.url, publishedAt: a.publishedAt, topic: a.topicId ? byId.get(a.topicId) ?? null : null })),
  );
  return { ...base, race: null, announcements };
}

export type OutletProfile = NonNullable<Awaited<ReturnType<typeof getOutletProfile>>>;

export const isIndexableOutlet = (p: { kind: "NEWS" | "PRESS" | "SOCIAL"; total: number }) =>
  p.kind !== "SOCIAL" && p.total >= OUTLET_INDEX_MIN[p.kind];
