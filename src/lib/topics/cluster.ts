import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { chunk } from "@/lib/sql";
import { assignTopics, type TopicKey } from "./assign";
import { topicScore } from "./score";

/** この時間内に更新されたトピックだけを割り当て候補にする */
export const CLUSTER_WINDOW_HOURS = 48;
/** スコアを再計算する範囲。これより古いトピックはスコア 0 にする */
export const SCORE_WINDOW_HOURS = 72;

const hoursAgo = (h: number, now: Date) => new Date(now.getTime() - h * 3_600_000);

/** 未割り当て記事をトピックに振り分け、影響を受けたトピックの集計値を更新する */
export async function clusterArticles(now = new Date()): Promise<{ assigned: number; created: number }> {
  const since = hoursAgo(CLUSTER_WINDOW_HOURS, now);
  const docs = await prisma.article.findMany({
    where: {
      OR: [
        { topicId: null },
        { publishedAt: { gte: since }, topic: { lastSeenAt: { gte: since } } },
      ],
    },
    select: { id: true, title: true, publishedAt: true, topicId: true, genreId: true, publisher: true },
  });

  const assignment = assignTopics(docs);
  if (assignment.size === 0) return { assigned: 0, created: 0 };

  const byKey = new Map<TopicKey, number[]>();
  for (const [articleId, key] of assignment) {
    const ids = byKey.get(key) ?? [];
    ids.push(articleId);
    byKey.set(key, ids);
  }

  const docById = new Map(docs.map((d) => [d.id, d]));

  // データベースとの往復回数が記事数に比例しないよう、すべて一括で処理する。
  // 新規トピックの ID は先にシーケンスから確保し、明示的な ID で一括作成する。
  const newKeys = [...byKey.keys()].filter((k): k is `new:${number}` => typeof k !== "number");
  const ids = newKeys.length
    ? await prisma.$queryRaw<{ id: number }[]>`
        SELECT nextval(pg_get_serial_sequence('"Topic"', 'id'))::int AS id
        FROM generate_series(1, ${newKeys.length}::int)`
    : [];
  const topicIdOf = new Map<TopicKey, number>(newKeys.map((k, i) => [k, ids[i].id]));
  for (const key of byKey.keys()) {
    if (typeof key === "number") topicIdOf.set(key, key);
  }

  const newTopics = newKeys.map((key) => {
    const first = docById.get(byKey.get(key)![0])!;
    return {
      id: topicIdOf.get(key)!,
      title: first.title,
      genreId: first.genreId,
      firstSeenAt: first.publishedAt,
      lastSeenAt: first.publishedAt,
    };
  });

  const pairs = [...assignment].map(([articleId, key]) => [articleId, topicIdOf.get(key)!] as const);

  await prisma.$transaction([
    ...chunk(newTopics, 5_000).map((data) => prisma.topic.createMany({ data })),
    ...chunk(pairs, 5_000).map(
      (rows) => prisma.$executeRaw`
        UPDATE "Article" a SET "topicId" = v.tid
        FROM (VALUES ${Prisma.join(rows.map(([aid, tid]) => Prisma.sql`(${aid}::int, ${tid}::int)`))}) AS v(aid, tid)
        WHERE a.id = v.aid`,
    ),
  ]);

  await refreshTopics([...new Set(topicIdOf.values())]);
  return { assigned: assignment.size, created: newKeys.length };
}

/** トピックの件数・媒体数・期間・代表見出し・ジャンルを記事から再計算する */
export async function refreshTopics(topicIds: number[]) {
  if (topicIds.length === 0) return;

  await prisma.$executeRaw`
    UPDATE "Topic" t
    SET "articleCount" = a.cnt,
        "publisherCount" = a.pubs,
        "firstSeenAt" = a.first,
        "lastSeenAt" = a.last,
        "updatedAt" = now()
    FROM (
      -- 「報じた媒体数」には企業のプレスリリースを数えない（報道ではないため）
      SELECT ar."topicId", count(*)::int AS cnt,
             GREATEST(count(DISTINCT ar.publisher) FILTER (WHERE s.kind <> 'PRESS'), 1)::int AS pubs,
             min(ar."publishedAt") AS first, max(ar."publishedAt") AS last
      FROM "Article" ar
      JOIN "Source" s ON s.id = ar."sourceId"
      WHERE ar."topicId" = ANY(${topicIds})
      GROUP BY ar."topicId"
    ) a
    WHERE t.id = a."topicId"`;

  // 代表見出しは報道・企業発表を優先し、最も早い記事のものを使う。
  // ジャンルは報道記事の多数決（なければ全記事の多数決）。
  const articles = await prisma.article.findMany({
    where: { topicId: { in: topicIds } },
    select: { topicId: true, title: true, genreId: true, publishedAt: true, source: { select: { kind: true } } },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
  });
  const grouped = new Map<number, typeof articles>();
  for (const a of articles) {
    const list = grouped.get(a.topicId!) ?? [];
    list.push(a);
    grouped.set(a.topicId!, list);
  }

  const updates = [...grouped].map(([topicId, list]) => {
    const primary = list.filter((a) => a.source.kind !== "SOCIAL");
    const pool = primary.length ? primary : list;
    const votes = new Map<number, number>();
    for (const a of pool) votes.set(a.genreId, (votes.get(a.genreId) ?? 0) + 1);
    // 媒体の欄の多数決。AI が判定したジャンル（aiGenreId）があれば、更新時にそちらを優先する
    const genreId = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return Prisma.sql`(${topicId}::int, ${pool[0].title}::text, ${genreId}::int)`;
  });
  for (const rows of chunk(updates, 5_000)) {
    await prisma.$executeRaw`
      UPDATE "Topic" t SET title = v.title, "genreId" = COALESCE(t."aiGenreId", v.gid)
      FROM (VALUES ${Prisma.join(rows)}) AS v(id, title, gid)
      WHERE t.id = v.id`;
  }
}

/** 直近のトピックの話題度を再計算し、古いトピックはスコアを 0 にする */
export async function rescoreTopics(now = new Date()) {
  const since = hoursAgo(SCORE_WINDOW_HOURS, now);
  const rows = await prisma.$queryRaw<
    { id: number; newsPublishers: number; newsArticles: number; articleCount: number; lastSeenAt: Date; social: number; clicks: number; genre: string | null }[]
  >`
    SELECT t.id, t."articleCount", t."lastSeenAt", g.slug AS genre,
           count(DISTINCT a.publisher) FILTER (WHERE s.kind <> 'PRESS')::int AS "newsPublishers",
           count(a.id) FILTER (WHERE s.kind = 'NEWS')::int AS "newsArticles",
           coalesce(sum(a."socialCount"), 0)::int AS social,
           coalesce(sum(a.clicks), 0)::int AS clicks
    FROM "Topic" t
    LEFT JOIN "Genre" g ON g.id = t."genreId"
    LEFT JOIN "Article" a ON a."topicId" = t.id
    LEFT JOIN "Source" s ON s.id = a."sourceId"
    WHERE t."lastSeenAt" >= ${since}
    GROUP BY t.id, g.slug`;

  for (const part of chunk(rows, 10_000)) {
    const values = part.map(
      (r) =>
        Prisma.sql`(${r.id}::int, ${topicScore({
          // 企業プレスリリースは、報じた媒体の数に入れない（宣伝が「話題」に見えないように）
          publisherCount: r.newsPublishers,
          articleCount: r.articleCount,
          socialCount: r.social,
          clicks: r.clicks,
          lastSeenAt: r.lastSeenAt,
          genreSlug: r.genre ?? undefined,
          newsArticles: r.newsArticles,
        }, now)}::float8)`,
    );
    await prisma.$executeRaw`
      UPDATE "Topic" t SET score = v.score
      FROM (VALUES ${Prisma.join(values)}) AS v(id, score)
      WHERE t.id = v.id`;
  }

  await prisma.topic.updateMany({
    where: { lastSeenAt: { lt: since }, score: { gt: 0 } },
    data: { score: 0 },
  });

  return rows.length;
}
