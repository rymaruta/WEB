import { Prisma } from "@/generated/prisma/client";
import { summarizeTopics, type SummarizeResult } from "@/lib/ai/summarize";
import { prisma } from "@/lib/db";
import { genreResolver } from "@/lib/topics/genre-model";
import { parseFeed, type ParsedItem } from "@/lib/feed/parse";
import { cleanTitle, displayHost, splitSiteSuffix } from "@/lib/feed/text";
import { clusterArticles, rescoreTopics } from "@/lib/topics/cluster";
import { applyTopicGenreRules } from "@/lib/topics/genre-apply";
import { chunk } from "@/lib/sql";
import { fetchFeed } from "./fetch-feed";

/** 同じフィードを取得する最短間隔（分） */
const MIN_INTERVAL_MINUTES = 10;
/** これより古い記事は取り込まない */
const MAX_ITEM_AGE_DAYS = 7;
/** 記事の保持期間 */
const RETENTION_DAYS = 90;
/** 同時に取得するホスト数。同一ホストのフィードは直列に取得する */
const HOST_CONCURRENCY = 6;
/** 同一ホストへの連続アクセスの間隔 */
const SAME_HOST_DELAY_MS = 1_000;
/** 収集開始からこの時間を過ぎたら、新しいまとめ記事の作成を始めない */
const AI_DEADLINE_MS = 200_000;
/** SOCIAL フィード経由でも取り込まないリンク先（匿名投稿など、発信者と品質を確認できないもの） */
const EXCLUDED_HOSTS = new Set(["anond.hatelabo.jp"]);

type SourceRow = Awaited<ReturnType<typeof loadSources>>[number];

export type SourceResult = {
  sourceId: number;
  name: string;
  status: "ok" | "not-modified" | "error";
  fetched: number;
  inserted: number;
  error?: string;
};

export type CrawlSummary = {
  sources: SourceResult[];
  inserted: number;
  assigned: number;
  topicsCreated: number;
  topicsScored: number;
  /** 話題のジャンルの見直し（見た件数・変えた件数・AI に見直しを頼んだ件数） */
  genreRules: { checked: number; changed: number; recheck: number } | null;
  pruned: number;
  ai: SummarizeResult;
  durationMs: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadSources(force: boolean, sourceIds?: number[]) {
  const due = new Date(Date.now() - MIN_INTERVAL_MINUTES * 60_000);
  return prisma.source.findMany({
    where: {
      active: true,
      ...(sourceIds ? { id: { in: sourceIds } } : {}),
      ...(force ? {} : { OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: due } }] }),
    },
    orderBy: { id: "asc" },
  });
}

/** SOCIAL フィード経由の記事は、リンク先ドメインから掲載元名を決める */
async function buildHostPublisherMap() {
  const all = await prisma.source.findMany({ where: { kind: { not: "SOCIAL" } }, select: { siteUrl: true, publisher: true } });
  return new Map(all.map((s) => [displayHost(s.siteUrl), s.publisher]));
}

function normalizePublishedAt(item: ParsedItem, now: Date): Date | null {
  const d = item.publishedAt ?? now;
  // 未来日時は取得時刻に丸め、古すぎる記事は捨てる
  if (d.getTime() > now.getTime() + 5 * 60_000) return now;
  if (d.getTime() < now.getTime() - MAX_ITEM_AGE_DAYS * 86_400_000) return null;
  return d;
}

type GenreOf = (source: { feedUrl: string; genreId: number }, title: string, summary?: string | null, publisher?: string) => number;

async function crawlSource(source: SourceRow, hostPublishers: Map<string, string>, genreOf: GenreOf | null): Promise<SourceResult> {
  const base = { sourceId: source.id, name: source.name };
  const now = new Date();
  try {
    const res = await fetchFeed(source.feedUrl, { etag: source.etag, lastModified: source.lastModified });
    if (res.status === "not-modified") {
      await prisma.source.update({
        where: { id: source.id },
        data: { lastFetchedAt: now, lastSuccessAt: now, lastError: null, consecutiveFailures: 0 },
      });
      return { ...base, status: "not-modified", fetched: 0, inserted: 0 };
    }

    const feed = parseFeed(res.body, source.feedUrl);
    const names = [source.publisher, source.name, feed.title];

    const rows = feed.items.flatMap((item) => {
      const publishedAt = normalizePublishedAt(item, now);
      if (!publishedAt) return [];
      const host = displayHost(item.url);
      if (EXCLUDED_HOSTS.has(host)) return [];
      let publisher = source.publisher;
      let title = cleanTitle(item.rawTitle, names);
      if (source.kind === "SOCIAL") {
        // リンク先ページの <title> 末尾のサイト名を掲載元名として使う（既知の媒体は登録名を優先）
        const split = splitSiteSuffix(title);
        title = split.title;
        publisher = hostPublishers.get(host) ?? split.site ?? host;
      }
      if (!title) return [];
      return [{
        url: item.url,
        title: title.slice(0, 300),
        summary: item.summary,
        imageUrl: item.imageUrl,
        publisher,
        publishedAt,
        socialCount: item.socialCount,
        sourceId: source.id,
        // ジャンルの混ざったフィードは、見出しから判定し直す（src/lib/topics/genre-model.ts）
        genreId: genreOf ? genreOf(source, title, item.summary, publisher) : source.genreId,
      }];
    });

    // フィード内の重複 URL を除去
    const unique = [...new Map(rows.map((r) => [r.url, r])).values()];

    const { count: inserted } = await prisma.article.createMany({ data: unique, skipDuplicates: true });

    // 既存記事の話題シグナル（ブックマーク数）の増加と、未取得だったサムネイルを一括で反映
    const refreshable = unique.filter((r) => r.socialCount > 0 || r.imageUrl);
    for (const rows of chunk(refreshable, 5_000)) {
      await prisma.$executeRaw`
        UPDATE "Article" a
        SET "socialCount" = GREATEST(a."socialCount", v.cnt),
            "imageUrl" = COALESCE(a."imageUrl", v.img)
        FROM (VALUES ${Prisma.join(rows.map((r) => Prisma.sql`(${r.url}::text, ${r.socialCount}::int, ${r.imageUrl}::text)`))}) AS v(url, cnt, img)
        WHERE a.url = v.url AND (a."socialCount" < v.cnt OR (a."imageUrl" IS NULL AND v.img IS NOT NULL))`;
    }

    await prisma.source.update({
      where: { id: source.id },
      data: {
        etag: res.etag,
        lastModified: res.lastModified,
        lastFetchedAt: now,
        lastSuccessAt: now,
        lastError: null,
        consecutiveFailures: 0,
      },
    });
    return { ...base, status: "ok", fetched: feed.items.length, inserted };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.source.update({
      where: { id: source.id },
      data: { lastFetchedAt: now, lastError: message.slice(0, 500), consecutiveFailures: { increment: 1 } },
    });
    return { ...base, status: "error", fetched: 0, inserted: 0, error: message };
  }
}

export async function runCrawl(options: { force?: boolean; sourceIds?: number[] } = {}): Promise<CrawlSummary> {
  const started = Date.now();
  const sources = await loadSources(options.force ?? false, options.sourceIds);
  const hostPublishers = await buildHostPublisherMap();

  // ホスト単位のキューにまとめ、ホスト間は並列・ホスト内は直列で取得する
  const byHost = new Map<string, SourceRow[]>();
  for (const s of sources) {
    const host = displayHost(s.feedUrl);
    byHost.set(host, [...(byHost.get(host) ?? []), s]);
  }
  const queues = [...byHost.values()];
  const results: SourceResult[] = [];
  // 判定の準備に失敗しても、フィードのジャンルのまま収集は続ける
  const genreOf = await genreResolver().catch(() => null);
  const worker = async () => {
    for (let queue = queues.shift(); queue; queue = queues.shift()) {
      for (const [i, s] of queue.entries()) {
        if (i > 0) await sleep(SAME_HOST_DELAY_MS);
        results.push(await crawlSource(s, hostPublishers, genreOf));
      }
    }
  };
  await Promise.all(Array.from({ length: HOST_CONCURRENCY }, worker));

  const { assigned, created } = await clusterArticles();
  const topicsScored = await rescoreTopics();
  // 話題のジャンルの見直し（判定の記録・AI との食い違いの見直し）。失敗しても収集は続ける
  const genreRules = await applyTopicGenreRules(2).catch(() => null);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const { count: pruned } = await prisma.article.deleteMany({ where: { publishedAt: { lt: cutoff } } });
  if (pruned > 0) await prisma.topic.deleteMany({ where: { articles: { none: {} } } });

  // 残り時間でまとめ記事を作成する（関数の実行時間上限 300 秒に余裕を残す）
  const ai = await summarizeTopics(started + AI_DEADLINE_MS);

  return {
    sources: results.sort((a, b) => a.sourceId - b.sourceId),
    inserted: results.reduce((n, r) => n + r.inserted, 0),
    assigned,
    topicsCreated: created,
    topicsScored,
    genreRules: genreRules && { checked: genreRules.checked, changed: genreRules.changed, recheck: genreRules.recheck },
    pruned,
    ai,
    durationMs: Date.now() - started,
  };
}
