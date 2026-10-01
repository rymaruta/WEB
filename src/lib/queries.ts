import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { releaseSortKey } from "@/lib/game";
import { parseSearchTerms, rankSearchResults } from "@/lib/search-terms";
import { countReports, diversifyRising, type RisingRow } from "@/lib/topics/rising";

/** 「いま話題」の対象期間 */
export const TRENDING_HOURS = 48;
const since = (hours: number) => new Date(Date.now() - hours * 3_600_000);

const articlePreview = {
  select: {
    id: true,
    title: true,
    summary: true,
    imageUrl: true,
    publisher: true,
    publishedAt: true,
    source: { select: { kind: true } },
  },
  orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
} satisfies Prisma.Topic$articlesArgs;

const topicCardInclude = {
  genre: true,
  articles: articlePreview,
} satisfies Prisma.TopicInclude;

export type TopicCardData = Prisma.TopicGetPayload<{ include: typeof topicCardInclude }>;

export const getGenres = cache(() => prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }));

export const getGenre = cache((slug: string) => prisma.genre.findUnique({ where: { slug } }));

/** 話題度順のトピック。minPublishers で「複数媒体が報じたもの」に絞れる */
export function getTrendingTopics(opts: {
  genreId?: number;
  minPublishers?: number;
  skip?: number;
  take: number;
  excludeIds?: number[];
}) {
  return prisma.topic.findMany({
    where: {
      lastSeenAt: { gte: since(TRENDING_HOURS) },
      ...(opts.genreId ? { genreId: opts.genreId } : {}),
      ...(opts.minPublishers ? { publisherCount: { gte: opts.minPublishers } } : {}),
      ...(opts.excludeIds?.length ? { id: { notIn: opts.excludeIds } } : {}),
    },
    orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
    skip: opts.skip,
    take: opts.take,
    include: topicCardInclude,
  });
}

export function countTrendingTopics(genreId?: number) {
  return prisma.topic.count({
    where: { lastSeenAt: { gte: since(TRENDING_HOURS) }, ...(genreId ? { genreId } : {}) },
  });
}

/** 新着順のトピック */
export function getLatestTopics(opts: { genreId?: number; skip?: number; take: number }) {
  return prisma.topic.findMany({
    where: opts.genreId ? { genreId: opts.genreId } : {},
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    skip: opts.skip,
    take: opts.take,
    include: topicCardInclude,
  });
}

export function countTopics(genreId?: number) {
  return prisma.topic.count({ where: genreId ? { genreId } : {} });
}

export const getTopic = cache((id: number) =>
  prisma.topic.findUnique({
    where: { id },
    include: {
      genre: true,
      articles: {
        orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
        include: { source: { select: { kind: true, name: true } } },
      },
    },
  }),
);

/** 記事一覧のリンク先を決めるため、AI まとめ記事の有無を一緒に読む */
const withTopic = { genre: true, topic: { select: { id: true, aiGeneratedAt: true } } } as const;

/** サイト内で読まれている記事（外部リンクのクリック数順） */
/** よく読まれている記事。報道機関の記事に限る（SNS のまとめやプレスリリースは「SNSで話題」などで扱う） */
export function getMostRead(take: number) {
  return prisma.article.findMany({
    where: { publishedAt: { gte: since(TRENDING_HOURS) }, clicks: { gt: 0 }, source: { kind: "NEWS" } },
    orderBy: [{ clicks: "desc" }, { publishedAt: "desc" }],
    take,
    include: withTopic,
  });
}

/** SNS（はてなブックマーク）で話題の記事 */
export function getSocialBuzz(take: number, genreId?: number) {
  return prisma.article.findMany({
    where: {
      publishedAt: { gte: since(TRENDING_HOURS) },
      socialCount: { gt: 0 },
      ...(genreId ? { genreId } : {}),
    },
    orderBy: [{ socialCount: "desc" }, { publishedAt: "desc" }],
    take,
    include: withTopic,
  });
}

export function getLatestArticles(take: number, genreId?: number) {
  return prisma.article.findMany({
    where: genreId ? { genreId } : {},
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    include: withTopic,
  });
}

/** 見出しの部分一致検索（pg_trgm インデックスを利用） */
/** 検索で並べ替える対象の上限（これより多く当てはまる場合は、新しいものから数える） */
const SEARCH_RANK_LIMIT = 300;

/**
 * すべての語を含むトピック。見出し（話題の見出し・AI まとめ記事の見出し）に語が入っているものを先に、
 * 各媒体の見出しにだけ入っているものを後に並べ、それぞれ新しい順にする
 */
export async function searchTopics(q: string, skip: number, take: number) {
  const terms = parseSearchTerms(q);
  if (terms.length === 0) return { items: [], total: 0 };
  const where: Prisma.TopicWhereInput = {
    AND: terms.map((t) => ({
      OR: [
        { title: { contains: t, mode: "insensitive" } },
        { aiTitle: { contains: t, mode: "insensitive" } },
        { articles: { some: { title: { contains: t, mode: "insensitive" } } } },
      ],
    })),
  };
  const [candidates, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: SEARCH_RANK_LIMIT,
      select: { id: true, title: true, aiTitle: true },
    }),
    prisma.topic.count({ where }),
  ]);
  const ids = rankSearchResults(candidates, terms).slice(skip, skip + take);
  const found = await prisma.topic.findMany({ where: { id: { in: ids } }, include: topicCardInclude });
  const byId = new Map(found.map((t) => [t.id, t]));
  return { items: ids.map((id) => byId.get(id)!).filter(Boolean), total: Math.min(total, SEARCH_RANK_LIMIT) };
}

export async function getSourcesWithStats() {
  const [sources, counts] = await Promise.all([
    prisma.source.findMany({ include: { genre: true }, orderBy: [{ genre: { sortOrder: "asc" } }, { name: "asc" }] }),
    prisma.article.groupBy({
      by: ["sourceId"],
      where: { publishedAt: { gte: since(24) } },
      _count: { _all: true },
    }),
  ]);
  const bySource = new Map(counts.map((c) => [c.sourceId, c._count._all]));
  return sources.map((s) => ({ ...s, articles24h: bySource.get(s.id) ?? 0 }));
}

export async function getSiteStats() {
  const [articles24h, publishers] = await Promise.all([
    prisma.article.count({ where: { publishedAt: { gte: since(24) } } }),
    prisma.source.findMany({ where: { active: true, kind: { not: "SOCIAL" } }, distinct: ["publisher"], select: { publisher: true } }),
  ]);
  return { articles24h, publishers: publishers.length };
}

/** AI まとめ記事のあるトピック（新しい順） */
export async function getAiArticles(skip: number, take: number) {
  const where: Prisma.TopicWhereInput = { aiGeneratedAt: { not: null } };
  const [items, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: [{ aiGeneratedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: topicCardInclude,
    }),
    prisma.topic.count({ where }),
  ]);
  return { items, total };
}

/** いま話題のキーワード（AI が出来事ごとに付けた短い語。話題の大きい順、重複なし） */
export const getTrendingKeywords = cache(async (take: number) => {
  const stories = await prisma.story.findMany({
    where: {
      createdAt: { gte: since(TRENDING_HOURS) },
      keyword: { not: null },
      status: { in: ["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"] },
    },
    orderBy: { score: "desc" },
    take: take * 4,
    select: { keyword: true },
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { keyword } of stories) {
    const k = keyword!.trim();
    if (!k || k.length > 20 || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= take) break;
  }
  return out;
});

/** 企業ページ：その企業を取り上げた話題（新しい順） */
export async function getCompanyTopics(name: string, skip: number, take: number) {
  const where: Prisma.TopicWhereInput = { aiCompanies: { has: name } };
  const [items, total] = await Promise.all([
    prisma.topic.findMany({ where, orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }], skip, take, include: topicCardInclude }),
    prisma.topic.count({ where }),
  ]);
  return { items, total };
}

/** よく取り上げられている企業（直近 days 日の話題数の多い順） */
export const getTopCompanies = cache(async (days: number, take: number, minTopics = 1) => {
  const rows = await prisma.$queryRaw<{ name: string; topics: bigint }[]>`
    SELECT c AS name, COUNT(*) AS topics
    FROM "Topic", unnest("aiCompanies") AS c
    WHERE "lastSeenAt" >= ${since(days * 24)}
    GROUP BY c
    HAVING COUNT(*) >= ${minTopics}
    ORDER BY topics DESC, c ASC
    LIMIT ${take}`;
  return rows.map((r) => ({ name: r.name, topics: Number(r.topics) }));
});

/** ある時刻より後に初めて報じられた話題（話題の大きい順）。前回の訪問からの新着に使う */
export async function getTopicsSince(since: Date, take: number) {
  const where: Prisma.TopicWhereInput = { firstSeenAt: { gt: since } };
  const [items, total] = await Promise.all([
    prisma.topic.findMany({ where, orderBy: [{ score: "desc" }, { id: "desc" }], take, include: topicCardInclude }),
    prisma.topic.count({ where }),
  ]);
  return { items, total };
}

export type CompanyIndexRow = { name: string; topics: number; lastSeenAt: Date; latest: string; genreSlug: string; genreName: string };

/** 企業別ニュースの一覧。直近 days 日に取り上げた企業ごとの話題数・最新の見出し・主なジャンル（最近の順） */
export const getCompanyIndex = cache(async (days: number, take: number): Promise<CompanyIndexRow[]> => {
  const rows = await prisma.$queryRaw<{ name: string; topics: bigint; last: Date; latest: string; genreId: number }[]>`
    WITH c AS (
      SELECT unnest(t."aiCompanies") AS name, t."lastSeenAt", COALESCE(t."aiTitle", t.title) AS title, t."genreId"
      FROM "Topic" t
      WHERE t."lastSeenAt" >= ${since(days * 24)}
    )
    SELECT name, COUNT(*) AS topics, MAX("lastSeenAt") AS last,
      (ARRAY_AGG(title ORDER BY "lastSeenAt" DESC))[1] AS latest,
      MODE() WITHIN GROUP (ORDER BY "genreId") AS "genreId"
    FROM c
    GROUP BY name
    ORDER BY last DESC, topics DESC
    LIMIT ${take}`;
  const genres = new Map((await getGenres()).map((g) => [g.id, g]));
  return rows.map((r) => ({
    name: r.name,
    topics: Number(r.topics),
    lastSeenAt: r.last,
    latest: r.latest,
    genreSlug: genres.get(r.genreId)?.slug ?? "",
    genreName: genres.get(r.genreId)?.name ?? "",
  }));
});

/** 検索語に名前が当てはまる企業（直近の話題がある企業から、話題の多い順） */
export async function findCompaniesByName(q: string, take: number) {
  const fold = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const key = fold(q);
  if (key.length < 2) return [];
  const all = await getTopCompanies(90, 2000);
  return all.filter((c) => fold(c.name).includes(key)).slice(0, take);
}

/** 急上昇：直近 hours 時間に新しく報じた媒体の数が多い話題（それ以前と比べて伸びているほど上） */
export const getRisingTopics = cache(async (hours: number, take: number) => {
  const rows = await prisma.$queryRaw<RisingRow[]>`
    WITH a AS (
      SELECT ar."topicId", ar.publisher, MIN(ar."publishedAt") AS first,
        (ARRAY_AGG(ar.title ORDER BY ar."publishedAt"))[1] AS title
      FROM "Article" ar
      JOIN "Source" s ON s.id = ar."sourceId"
      WHERE ar."topicId" IS NOT NULL AND s.kind = 'NEWS' AND ar."publishedAt" >= ${since(TRENDING_HOURS)}
      GROUP BY ar."topicId", ar.publisher
    )
    SELECT * FROM a
    WHERE "topicId" IN (SELECT "topicId" FROM a WHERE first >= ${since(hours)} GROUP BY "topicId" HAVING COUNT(*) >= 2)`;
  const pool = [...countReports(rows, since(hours))]
    // 転載を除いて、直近に2つ以上の報道がある話題だけ
    .filter(([, c]) => c.recent >= 2)
    .map(([id, c]) => ({ id, recent: c.publishers, reports: c.recent, before: c.before }))
    // 新しい報道の数に、それ以前と比べた伸びを加える（以前から大きい話題より、いま広がっている話題を上に）
    .map((r) => ({ ...r, rise: r.reports + r.reports / (r.before + 1) }))
    .sort((a, b) => b.rise - a.rise)
    // 同じ出来事やジャンルの偏りを除くので、多めに候補を取る
    .slice(0, take * 5);
  const topics = await prisma.topic.findMany({ where: { id: { in: pool.map((r) => r.id) } }, include: topicCardInclude });
  const byId = new Map(topics.map((t) => [t.id, t]));
  const candidates = pool.flatMap((r) => {
    const topic = byId.get(r.id);
    return topic ? [{ ...r, topic, title: topic.aiTitle ?? topic.title, genreId: topic.genreId, score: topic.score }] : [];
  });
  return diversifyRising(candidates, take).map((c) => ({ topic: c.topic, recent: c.recent }));
});

export type GameRelease = { topicId: number; title: string; release: string; platforms: string[]; kind: string | null };

/**
 * ゲームの発売予定。作品ごとに最も新しい報道の発売日を使い（延期などで変わった日付を反映する）、
 * まだ来ていない日付だけを日付順に返す。日付が月・年までのものは、その月・年の終わりまで残す
 */
export const getGameReleases = cache(async (now = new Date()): Promise<GameRelease[]> => {
  const topics = await prisma.topic.findMany({
    // ゲーム本体の発表・発売日の決定・発売の報道だけ（噂・リークは公式の日付ではないので載せない。アップデートやセールの日付も載せない）
    where: { aiGameRelease: { not: null }, aiGameTitle: { not: null }, aiGameKind: { in: ["announce", "release_date", "release"] }, lastSeenAt: { gte: since(24 * 365) } },
    orderBy: { lastSeenAt: "desc" },
    take: 2000,
    select: { id: true, aiGameTitle: true, aiGameRelease: true, aiGamePlatforms: true, aiGameKind: true },
  });
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const seen = new Set<string>();
  const out: GameRelease[] = [];
  for (const t of topics) {
    const key = t.aiGameTitle!.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const r = t.aiGameRelease!;
    // まだ来ていないか（月・年までの予定は、その期間が終わるまで）
    if (today.slice(0, r.length) > r) continue;
    out.push({ topicId: t.id, title: t.aiGameTitle!, release: r, platforms: t.aiGamePlatforms, kind: t.aiGameKind });
  }
  return out.sort((a, b) => releaseSortKey(a.release).localeCompare(releaseSortKey(b.release)));
});

/** 新着ゲーム：直近に新作の発表・発売日の決定が報じられた作品（新しい順、作品ごとに1件） */
export const getNewGames = cache(async (days: number, take: number) => {
  const topics = await prisma.topic.findMany({
    where: { aiGameKind: { in: ["announce", "release_date"] }, aiGameTitle: { not: null }, firstSeenAt: { gte: since(days * 24) } },
    orderBy: { firstSeenAt: "desc" },
    take: take * 3,
    include: topicCardInclude,
  });
  const seen = new Set<string>();
  return topics
    .filter((t) => {
      const key = t.aiGameTitle!.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .slice(0, take);
});
