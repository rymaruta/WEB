import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
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
  let created = 0;
  const touched = new Set<number>();

  await prisma.$transaction(
    async (tx) => {
      for (const [key, articleIds] of byKey) {
        let topicId: number;
        if (typeof key === "number") {
          topicId = key;
        } else {
          const first = docById.get(articleIds[0])!;
          const topic = await tx.topic.create({
            data: {
              title: first.title,
              genreId: first.genreId,
              firstSeenAt: first.publishedAt,
              lastSeenAt: first.publishedAt,
            },
            select: { id: true },
          });
          topicId = topic.id;
          created++;
        }
        await tx.article.updateMany({ where: { id: { in: articleIds } }, data: { topicId } });
        touched.add(topicId);
      }
    },
    { timeout: 60_000 },
  );

  await refreshTopics([...touched]);
  return { assigned: assignment.size, created };
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
      SELECT "topicId", count(*)::int AS cnt, count(DISTINCT publisher)::int AS pubs,
             min("publishedAt") AS first, max("publishedAt") AS last
      FROM "Article"
      WHERE "topicId" = ANY(${topicIds})
      GROUP BY "topicId"
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

  for (const [topicId, list] of grouped) {
    const primary = list.filter((a) => a.source.kind !== "SOCIAL");
    const pool = primary.length ? primary : list;
    const votes = new Map<number, number>();
    for (const a of pool) votes.set(a.genreId, (votes.get(a.genreId) ?? 0) + 1);
    const genreId = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    await prisma.topic.update({ where: { id: topicId }, data: { title: pool[0].title, genreId } });
  }
}

/** 直近のトピックの話題度を再計算し、古いトピックはスコアを 0 にする */
export async function rescoreTopics(now = new Date()) {
  const since = hoursAgo(SCORE_WINDOW_HOURS, now);
  const rows = await prisma.$queryRaw<
    { id: number; publisherCount: number; articleCount: number; lastSeenAt: Date; social: number; clicks: number }[]
  >`
    SELECT t.id, t."publisherCount", t."articleCount", t."lastSeenAt",
           coalesce(sum(a."socialCount"), 0)::int AS social,
           coalesce(sum(a.clicks), 0)::int AS clicks
    FROM "Topic" t
    LEFT JOIN "Article" a ON a."topicId" = t.id
    WHERE t."lastSeenAt" >= ${since}
    GROUP BY t.id`;

  if (rows.length > 0) {
    const values = rows.map(
      (r) =>
        Prisma.sql`(${r.id}::int, ${topicScore({
          publisherCount: r.publisherCount,
          articleCount: r.articleCount,
          socialCount: r.social,
          clicks: r.clicks,
          lastSeenAt: r.lastSeenAt,
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
