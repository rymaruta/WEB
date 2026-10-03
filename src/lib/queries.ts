import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { releaseSortKey } from "@/lib/game";
import { titleKey } from "@/lib/game-listings";
import { isOutage, outageStatus, type OutageItem } from "@/lib/outages";
import { COUNTRIES, countTags, TAG_GENRES, TEAMS, type Tag, type TagKind } from "@/lib/tags";
import { parseSearchTerms, rankSearchResults, termVariants } from "@/lib/search-terms";
import { countReports, diversifyRising, type RisingRow } from "@/lib/topics/rising";
import { isRoutineTitle, isUnlistable } from "@/lib/topics/routine";
import { workKey } from "@/lib/work-keys";

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

export const topicCardInclude = {
  genre: true,
  articles: articlePreview,
} satisfies Prisma.TopicInclude;

export type TopicCardData = Prisma.TopicGetPayload<{ include: typeof topicCardInclude }>;

/** トップの一番上に固定中の話題（運営者が選んだ大きな出来事）。なければ null */
export const getPinnedTopic = cache(() =>
  prisma.topic.findFirst({
    where: { pinnedUntil: { gt: new Date() }, mergedIntoId: null },
    orderBy: { pinnedUntil: "desc" },
    include: topicCardInclude,
  }),
);

export const getGenres = cache(() => prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }));

export const getGenre = cache((slug: string) => prisma.genre.findUnique({ where: { slug } }));

/** 話題の一覧から外した分を補うために、多めに読む件数 */
const UNLISTABLE_MARGIN = 10;

/**
 * 話題度順のトピック。minPublishers で「複数媒体が報じたもの」に絞れる。
 * 定型の記事（占い・予告先発など）と、何が起きたかが書かれていない見出しの話題は出さない（src/lib/topics/routine.ts）
 */
export async function getTrendingTopics(opts: {
  genreId?: number;
  minPublishers?: number;
  skip?: number;
  take: number;
  excludeIds?: number[];
}) {
  const topics = await prisma.topic.findMany({
    where: {
      lastSeenAt: { gte: since(TRENDING_HOURS) },
      aiNotNews: false,
      ...(opts.genreId ? { genreId: opts.genreId } : {}),
      ...(opts.minPublishers ? { publisherCount: { gte: opts.minPublishers } } : {}),
      ...(opts.excludeIds?.length ? { id: { notIn: opts.excludeIds } } : {}),
      // ジャンルを決めない「話題」には、企業の発表（PR TIMES など）だけの話題を出さない（報道されたものだけ）。
      // 新商品などのジャンルの一覧では発表も出す
      ...(opts.genreId ? {} : { articles: { some: { source: { kind: "NEWS" } } } }),
    },
    orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
    skip: opts.skip,
    take: opts.take + UNLISTABLE_MARGIN,
    include: topicCardInclude,
  });
  return topics.filter((t) => !isUnlistable(t.aiTitle || t.title)).slice(0, opts.take);
}

export function countTrendingTopics(genreId?: number) {
  return prisma.topic.count({
    where: { lastSeenAt: { gte: since(TRENDING_HOURS) }, aiNotNews: false, ...(genreId ? { genreId } : {}) },
  });
}

/** 新着順のトピック */
export function getLatestTopics(opts: { genreId?: number; skip?: number; take: number }) {
  return prisma.topic.findMany({
    where: { aiNotNews: false, ...(opts.genreId ? { genreId: opts.genreId } : {}) },
    orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    skip: opts.skip,
    take: opts.take,
    include: topicCardInclude,
  });
}

export function countTopics(genreId?: number) {
  return prisma.topic.count({ where: { aiNotNews: false, ...(genreId ? { genreId } : {}) } });
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
/** 「よく読まれている」の対象期間（古い記事が上に残らないよう、話題の一覧より短くする） */
const MOST_READ_HOURS = 24;

export async function getMostRead(take: number) {
  const articles = await prisma.article.findMany({
    where: { publishedAt: { gte: since(MOST_READ_HOURS) }, clicks: { gt: 0 }, source: { kind: "NEWS" } },
    orderBy: [{ clicks: "desc" }, { publishedAt: "desc" }],
    take: take + UNLISTABLE_MARGIN,
    include: withTopic,
  });
  // 占い・セール情報など、毎日同じ形で出る記事は「よく読まれているニュース」に出さない
  return articles.filter((a) => !isRoutineTitle(a.title)).slice(0, take);
}

/**
 * 記事のジャンル。話題にまとめた記事は、話題のジャンル（内容から判定し直したもの）を使う
 * （媒体の欄のジャンルのままだと、SNS の「アニメとゲーム」欄の漫画の話題がゲームに出るなど、ずれることがある）
 */
const articleInGenre = (genreId: number): Prisma.ArticleWhereInput => ({ OR: [{ topic: { is: { genreId } } }, { topicId: null, genreId }] });

/** SNS（はてなブックマーク）で話題の記事 */
export function getSocialBuzz(take: number, genreId?: number) {
  return prisma.article.findMany({
    where: {
      publishedAt: { gte: since(TRENDING_HOURS) },
      socialCount: { gt: 0 },
      ...(genreId ? articleInGenre(genreId) : {}),
    },
    orderBy: [{ socialCount: "desc" }, { publishedAt: "desc" }],
    take,
    include: withTopic,
  });
}

export function getLatestArticles(take: number, genreId?: number) {
  return prisma.article.findMany({
    where: { NOT: { topic: { is: { aiNotNews: true } } }, ...(genreId ? articleInGenre(genreId) : {}) },
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
    // 語ごとに、表記ゆれ（全角・半角、ひらがな・カタカナ、略称）のどれかが見出しに含まれるもの
    AND: terms.map((t) => ({
      OR: termVariants(t).flatMap((v) => [
        { title: { contains: v, mode: "insensitive" as const } },
        { aiTitle: { contains: v, mode: "insensitive" as const } },
        { articles: { some: { title: { contains: v, mode: "insensitive" as const } } } },
      ]),
    })),
  };
  const [candidates, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      take: SEARCH_RANK_LIMIT,
      select: { id: true, title: true, aiTitle: true, lastSeenAt: true, publisherCount: true },
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

/** よく一緒に報じられる企業（同じ話題に名前が出た回数の多い順。直近 days 日） */
export const getRelatedCompanies = cache(async (name: string, take = 8, days = 180) => {
  const rows = await prisma.$queryRaw<{ name: string; together: bigint }[]>`
    SELECT c AS name, COUNT(*) AS together
    FROM "Topic", unnest("aiCompanies") AS c
    WHERE ${name} = ANY("aiCompanies") AND c <> ${name} AND "lastSeenAt" >= ${since(days * 24)} AND "mergedIntoId" IS NULL
    GROUP BY c
    ORDER BY together DESC, c ASC
    LIMIT ${take}`;
  return rows.map((r) => ({ name: r.name, together: Number(r.together) }));
});

/** 企業の主な出来事（決算・業績予想・M&A・株主還元・上場。新しい順） */
export const getCompanyEvents = cache(async (name: string, take = 8) =>
  prisma.topic.findMany({
    where: { aiCompanies: { has: name }, aiMarketEvent: { not: null }, mergedIntoId: null },
    orderBy: { firstSeenAt: "desc" },
    take,
    select: { id: true, title: true, aiTitle: true, aiMarketEvent: true, firstSeenAt: true },
  }),
);

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
  const counted = [...countReports(rows, since(hours))];
  // 転載を除いて、直近に3つ以上の報道がある話題を優先する（2媒体だけの小さな話題が上に来ないように）。足りなければ2つ以上まで広げる
  const strong = counted.filter(([, c]) => c.recent >= 3);
  const pool = (strong.length >= take ? strong : counted.filter(([, c]) => c.recent >= 2))
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

/** 同じ作品をまとめる目印（英語表記とカタカナ表記の違いは、読み取り時に付けた呼び名でまとめる） */
const gameKey = (t: { aiGameTitle: string | null; aiGameKey: string | null }) =>
  (t.aiGameKey || t.aiGameTitle || "").normalize("NFKC").toLowerCase().replace(/[\s・:：\-－]+/g, "");

export type GameRelease = {
  /** 記事のある作品は話題の ID。公式ストアだけの作品は null */
  topicId: number | null;
  title: string;
  release: string;
  platforms: string[];
  kind: string | null;
  /** 公式ストアだけの作品のストアのページ */
  storeUrl: string | null;
  /** 作品ページの呼び名（記事のある作品だけ。src/lib/works.ts） */
  workKey?: string | null;
};

/**
 * ゲームの発売予定。作品ごとに最も新しい報道の発売日を使い（延期などで変わった日付を反映する）、
 * まだ来ていない日付だけを日付順に返す。日付が月・年までのものは、その月・年の終わりまで残す
 */
export const getGameReleases = cache(async (now = new Date()): Promise<GameRelease[]> =>
  loadGameReleases(new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)),
);

/** ある月（YYYY-MM）に発売される作品。すでに発売された日の作品も含める（特集ページ用） */
export async function getGameReleasesInMonth(month: string): Promise<GameRelease[]> {
  return (await loadGameReleases(`${month}-01`)).filter((r) => r.release.startsWith(month));
}

/** today（YYYY-MM-DD）以降の発売予定 */
async function loadGameReleases(today: string): Promise<GameRelease[]> {
  const [topics, listings] = await Promise.all([
    prisma.topic.findMany({
      // ゲーム本体の発表・発売日の決定・発売の報道だけ（噂・リークは公式の日付ではないので載せない。アップデートやセールの日付も載せない）
      where: { aiGameRelease: { not: null }, aiGameTitle: { not: null }, aiGameKind: { in: ["announce", "release_date", "release"] }, lastSeenAt: { gte: since(24 * 365) } },
      orderBy: { lastSeenAt: "desc" },
      take: 2000,
      select: { id: true, aiGameTitle: true, aiGameKey: true, aiGameRelease: true, aiGamePlatforms: true, aiGameKind: true },
    }),
    // 公式ストアの発売予定（src/lib/game-listings.ts）
    prisma.gameListing.findMany({ where: { release: { gte: today.slice(0, 7) } }, orderBy: { release: "asc" }, take: 1000 }),
  ]);
  const seen = new Set<string>();
  const out: GameRelease[] = [];
  /** 記事から拾った作品の名前（公式ストアの作品と同じものを見分ける） */
  const byTitle = new Map<string, GameRelease>();
  for (const t of topics) {
    const key = gameKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = t.aiGameRelease!;
    // まだ来ていないか（月・年までの予定は、その期間が終わるまで）
    if (today.slice(0, r.length) > r) continue;
    const item = { topicId: t.id, title: t.aiGameTitle!, release: r, platforms: t.aiGamePlatforms, kind: t.aiGameKind, storeUrl: null, workKey: workKey(t.aiGameKey || t.aiGameTitle!) };
    out.push(item);
    byTitle.set(titleKey(t.aiGameTitle!), item);
  }
  for (const l of listings) {
    if (today.slice(0, l.release.length) > l.release) continue;
    const same = byTitle.get(titleKey(l.title));
    if (same) {
      // 記事のある作品は記事を優先し、公式ストアの機種を足す。日付が月までなら、公式の日付（日まで）を使う
      for (const p of l.platforms) if (!same.platforms.includes(p)) same.platforms = [...same.platforms, p];
      if (same.release.length < l.release.length && l.release.startsWith(same.release)) same.release = l.release;
      continue;
    }
    const item = { topicId: null, title: l.title, release: l.release, platforms: l.platforms, kind: "release_date", storeUrl: l.url };
    out.push(item);
    byTitle.set(titleKey(l.title), item);
  }
  return out.sort((a, b) => releaseSortKey(a.release).localeCompare(releaseSortKey(b.release)));
}

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
      const key = gameKey(t);
      return seen.has(key) ? false : (seen.add(key), true);
    })
    .slice(0, take);
});

/** 国別・チーム別のページ：見出しにその国・チームの言葉が入った話題（直近 days 日、新しい順） */
export async function getTagTopics(tag: Tag, skip: number, take: number, days = 90) {
  const genres = TAG_GENRES[tag.kind];
  const genreIds = genres ? (await getGenres()).filter((g) => genres.includes(g.slug)).map((g) => g.id) : null;
  const exclude = tag.exclude ?? null;
  const rows = await prisma.$queryRaw<{ id: number; total: bigint }[]>`
    SELECT t.id, COUNT(*) OVER () AS total
    FROM "Topic" t
    WHERE t."lastSeenAt" >= ${since(days * 24)}
      AND (${genreIds}::int[] IS NULL OR t."genreId" = ANY(${genreIds}::int[]) OR t."aiGenreId" = ANY(${genreIds}::int[]))
      AND (t.title ~ ${tag.pattern} OR COALESCE(t."aiTitle", '') ~ ${tag.pattern})
      AND (${exclude}::text IS NULL OR NOT (t.title ~ ${exclude}::text OR COALESCE(t."aiTitle", '') ~ ${exclude}::text))
    ORDER BY t."lastSeenAt" DESC, t.id DESC
    OFFSET ${skip} LIMIT ${take}`;
  const total = rows.length > 0 ? Number(rows[0].total) : skip > 0 ? await countTagTopics(tag, genreIds, days) : 0;
  const topics = await prisma.topic.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: topicCardInclude });
  const byId = new Map(topics.map((t) => [t.id, t]));
  return { items: rows.flatMap((r) => (byId.has(r.id) ? [byId.get(r.id)!] : [])), total };
}

async function countTagTopics(tag: Tag, genreIds: number[] | null, days: number) {
  const exclude = tag.exclude ?? null;
  const [row] = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM "Topic" t
    WHERE t."lastSeenAt" >= ${since(days * 24)}
      AND (${genreIds}::int[] IS NULL OR t."genreId" = ANY(${genreIds}::int[]) OR t."aiGenreId" = ANY(${genreIds}::int[]))
      AND (t.title ~ ${tag.pattern} OR COALESCE(t."aiTitle", '') ~ ${tag.pattern})
      AND (${exclude}::text IS NULL OR NOT (t.title ~ ${exclude}::text OR COALESCE(t."aiTitle", '') ~ ${exclude}::text))`;
  return Number(row?.total ?? 0);
}

/** ジャンルのページの「国・地域」「チーム」の入口：直近 days 日の、そのジャンルの話題の数が多い順 */
export const getTagCounts = cache(async (kind: TagKind, genreId: number, days = 7) => {
  const topics = await prisma.topic.findMany({
    where: { lastSeenAt: { gte: since(days * 24) }, OR: [{ genreId }, { aiGenreId: genreId }] },
    select: { title: true, aiTitle: true },
    take: 5000,
  });
  return countTags(kind === "country" ? COUNTRIES : TEAMS, topics.map((t) => `${t.title} ${t.aiTitle ?? ""}`));
});

/** IT のページの「障害・不具合情報」：直近 hours 時間に報じられた、通信・アプリなどの障害の話題（新しい順） */
export const getOutages = cache(async (hours = 72, take = 15): Promise<OutageItem[]> => {
  const topics = await prisma.topic.findMany({
    where: {
      firstSeenAt: { gte: since(hours) },
      genre: { slug: { in: ["tech", "domestic", "business", "life", "game"] } },
      // 報道機関の記事がある話題だけ（SNS の投稿だけの話題は、個人の体験談のことが多いため）
      articles: { some: { source: { kind: "NEWS" } } },
      OR: [{ title: { contains: "障害" } }, { title: { contains: "不具合" } }, { title: { contains: "つなが" } }, { title: { contains: "繋が" } }, { title: { contains: "復旧" } }, { title: { contains: "できない" } }, { title: { contains: "停止" } }, { title: { contains: "ダウン" } }, { aiTitle: { contains: "障害" } }, { aiTitle: { contains: "不具合" } }],
    },
    orderBy: { firstSeenAt: "desc" },
    take: 200,
    select: { id: true, title: true, aiTitle: true, firstSeenAt: true },
  });
  return topics
    .map((t) => ({ t, title: t.aiTitle ?? t.title }))
    .filter(({ t, title }) => isOutage(title) || isOutage(t.title))
    .slice(0, take)
    .map(({ t, title }) => ({ topicId: t.id, title, status: outageStatus(`${t.title} ${t.aiTitle ?? ""}`), at: t.firstSeenAt.toISOString() }));
});

export type EarningsItem = { topicId: number; company: string; event: string; title: string };

/** 経済のページの「今週の決算・業績予想」：直近 days 日に決算・業績予想が報じられた企業（企業ごとに最新の1件、新しい順） */
export const getRecentEarnings = cache(async (days = 7, take = 30): Promise<EarningsItem[]> => {
  const topics = await prisma.topic.findMany({
    where: { aiMarketEvent: { in: ["earnings", "forecast"] }, lastSeenAt: { gte: since(days * 24) }, NOT: { aiCompanies: { isEmpty: true } } },
    orderBy: { lastSeenAt: "desc" },
    take: 300,
    select: { id: true, title: true, aiTitle: true, aiCompanies: true, aiMarketEvent: true },
  });
  const seen = new Set<string>();
  const out: EarningsItem[] = [];
  for (const t of topics) {
    // 1社の決算の話題だけ（複数社をまとめた記事は、どの会社の数字か分かりにくいため）
    if (t.aiCompanies.length !== 1) continue;
    const company = t.aiCompanies[0];
    if (seen.has(company)) continue;
    seen.add(company);
    out.push({ topicId: t.id, company, event: t.aiMarketEvent!, title: t.aiTitle ?? t.title });
    if (out.length >= take) break;
  }
  return out;
});

/**
 * 報道の比べ方のページ用。直近の、3媒体以上が報じた話題の記事（報じた時刻と見出し）。
 * 速報ランキング（最初に報じた回数）と、見出しの数字が分かれたニュースに使う
 */
export async function getCoverageTopics(days: number, take = 800) {
  return prisma.topic.findMany({
    where: { lastSeenAt: { gte: since(days * 24) }, publisherCount: { gte: 3 }, mergedIntoId: null, aiNotNews: false },
    orderBy: { score: "desc" },
    take,
    select: {
      id: true,
      title: true,
      aiTitle: true,
      publisherCount: true,
      firstSeenAt: true,
      genre: { select: { slug: true, name: true } },
      articles: { select: { id: true, publisher: true, publishedAt: true, title: true, source: { select: { kind: true } } } },
    },
  });
}
