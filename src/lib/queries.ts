import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** 「いま話題」の対象期間 */
export const TRENDING_HOURS = 48;
const since = (hours: number) => new Date(Date.now() - hours * 3_600_000);

const articlePreview = {
  select: {
    id: true,
    title: true,
    summary: true,
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

/** サイト内で読まれている記事（外部リンクのクリック数順） */
export function getMostRead(take: number) {
  return prisma.article.findMany({
    where: { publishedAt: { gte: since(TRENDING_HOURS) }, clicks: { gt: 0 } },
    orderBy: [{ clicks: "desc" }, { publishedAt: "desc" }],
    take,
    include: { genre: true },
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
    include: { genre: true },
  });
}

export function getLatestArticles(take: number) {
  return prisma.article.findMany({
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    include: { genre: true },
  });
}

/** 見出しの部分一致検索（pg_trgm インデックスを利用） */
export async function searchTopics(q: string, skip: number, take: number) {
  const where: Prisma.TopicWhereInput = {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { articles: { some: { title: { contains: q, mode: "insensitive" } } } },
    ],
  };
  const [items, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: topicCardInclude,
    }),
    prisma.topic.count({ where }),
  ]);
  return { items, total };
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
