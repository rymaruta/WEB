import { cache } from "react";
import { prisma } from "@/lib/db";
import { topicCardInclude } from "@/lib/queries";
import { workKey, type WorkKind } from "@/lib/work-keys";

/**
 * 作品ページ（ゲーム・アニメ）。同じ作品の話題を1つのページにまとめ、発売日・放送日と、これまでのニュースを並べる。
 * 「◯◯ 発売日」「◯◯ いつから」と探す人に、日付と最新の報道をまとめて答えるページ
 */

export { workKey, workPath, type WorkKind } from "@/lib/work-keys";

/** 作品として拾う話題の範囲（日数） */
const WORK_DAYS = 730;
/** 作品ページに並べる話題の数 */
const MAX_TOPICS = 30;

export type Work = {
  kind: WorkKind;
  key: string;
  title: string;
  /** 発売日・放送開始日（YYYY-MM-DD・YYYY-MM・YYYY）。分からなければ null */
  date: string | null;
  /** ゲームは機種、アニメは放送局・配信サービス */
  platforms: string[];
  /** アニメの種類（tv・stream・movie） */
  animeKind: string | null;
  storeUrl: string | null;
  topics: Awaited<ReturnType<typeof loadTopics>>;
  /** 検索エンジンに出すか（話題が2つ以上か、まとめ記事がある作品だけ。中身の薄いページを出さない） */
  indexable: boolean;
};

const since = () => new Date(Date.now() - WORK_DAYS * 86_400_000);

function loadTopics(ids: number[]) {
  return prisma.topic.findMany({
    where: { id: { in: ids }, mergedIntoId: null },
    orderBy: { firstSeenAt: "desc" },
    take: MAX_TOPICS,
    include: topicCardInclude,
  });
}

/** 見出しに作品名が入った話題（作品の情報を読み取っていない話題も、ページに集める） */
async function topicsMentioning(title: string, genre: string): Promise<number[]> {
  if ([...title].length < 4) return [];
  const rows = await prisma.topic.findMany({
    where: { genre: { slug: genre }, mergedIntoId: null, aiNotNews: false, lastSeenAt: { gte: since() }, OR: [{ title: { contains: title } }, { aiTitle: { contains: title } }] },
    orderBy: { lastSeenAt: "desc" },
    take: MAX_TOPICS,
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** 多い順（同じ数なら最初に出てきた順） */
function byFrequency(values: string[]): string[] {
  const n = new Map<string, number>();
  for (const v of values) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)!);
}

const gameRows = cache(() =>
  prisma.topic.findMany({
    where: { aiGameTitle: { not: null }, mergedIntoId: null, aiNotNews: false, lastSeenAt: { gte: since() } },
    orderBy: { lastSeenAt: "desc" },
    take: 5000,
    select: { id: true, aiGameTitle: true, aiGameKey: true, aiGameRelease: true, aiGameKind: true, aiGamePlatforms: true, aiTitle: true },
  }),
);

const animeRows = cache(() =>
  prisma.topic.findMany({
    where: { aiAnimeTitle: { not: null }, mergedIntoId: null, aiNotNews: false, lastSeenAt: { gte: since() } },
    orderBy: { lastSeenAt: "desc" },
    take: 5000,
    select: { id: true, aiAnimeTitle: true, aiAnimeDate: true, aiAnimeKind: true, aiAnimeChannel: true, aiTitle: true },
  }),
);

const gameKeyOf = (t: { aiGameKey: string | null; aiGameTitle: string | null }) => workKey(t.aiGameKey || t.aiGameTitle || "");

export const getGameWork = cache(async (key: string): Promise<Work | null> => {
  const rows = (await gameRows()).filter((t) => gameKeyOf(t) === key);
  if (rows.length === 0) return null;
  const title = rows[0].aiGameTitle!;
  // 発売日は、ゲーム本体の発表・発売日の決定・発売を伝えた最も新しい報道のもの（延期などを反映する）
  const dated = rows.find((t) => t.aiGameRelease && ["announce", "release_date", "release"].includes(t.aiGameKind ?? ""));
  let date = dated?.aiGameRelease ?? null;
  let storeUrl: string | null = null;
  const platforms = byFrequency(rows.flatMap((t) => t.aiGamePlatforms));
  // 公式ストアの発売予定（日まで分かっていれば、そちらで詳しくする）
  const listings = await prisma.gameListing.findMany({ where: { title: { contains: title.slice(0, 20) } }, take: 20 });
  const listing = listings.find((l) => workKey(l.title) === workKey(title));
  if (listing) {
    storeUrl = listing.url;
    if (!date || (date.length < listing.release.length && listing.release.startsWith(date))) date = listing.release;
    for (const p of listing.platforms) if (!platforms.includes(p)) platforms.push(p);
  }
  const ids = [...new Set([...rows.map((t) => t.id), ...(await topicsMentioning(title, "game"))])];
  const topics = await loadTopics(ids);
  return { kind: "game", key, title, date, platforms, animeKind: null, storeUrl, topics, indexable: topics.length >= 2 || rows.some((t) => t.aiTitle) };
});

export const getAnimeWork = cache(async (key: string): Promise<Work | null> => {
  const rows = (await animeRows()).filter((t) => workKey(t.aiAnimeTitle!) === key);
  if (rows.length === 0) return null;
  const title = rows[0].aiAnimeTitle!;
  let date = rows.find((t) => t.aiAnimeDate)?.aiAnimeDate ?? null;
  const platforms = byFrequency(rows.map((t) => t.aiAnimeChannel).filter((c): c is string => !!c));
  // テレビアニメの放送開始予定の一覧（Wikipedia）
  const listings = await prisma.animeListing.findMany({ where: { title: { contains: title.slice(0, 20) } }, take: 20 });
  const listing = listings.find((l) => workKey(l.title) === key);
  if (listing) {
    if (!date || (date.length < listing.start.length && listing.start.startsWith(date))) date = listing.start;
    if (listing.channel && !platforms.includes(listing.channel)) platforms.push(listing.channel);
  }
  const ids = [...new Set([...rows.map((t) => t.id), ...(await topicsMentioning(title, "anime"))])];
  const topics = await loadTopics(ids);
  return {
    kind: "anime",
    key,
    title,
    date,
    platforms,
    animeKind: rows[0].aiAnimeKind,
    storeUrl: null,
    topics,
    indexable: topics.length >= 2 || rows.some((t) => t.aiTitle),
  };
});

/** サイトマップ用：検索エンジンに出す作品ページ（話題が2つ以上か、まとめ記事がある作品） */
export async function listIndexableWorks(): Promise<{ kind: WorkKind; key: string }[]> {
  const out: { kind: WorkKind; key: string }[] = [];
  const add = (kind: WorkKind, rows: { key: string; aiTitle: string | null }[]) => {
    const g = new Map<string, { n: number; ai: boolean }>();
    for (const r of rows) {
      if (!r.key) continue;
      const v = g.get(r.key) ?? { n: 0, ai: false };
      g.set(r.key, { n: v.n + 1, ai: v.ai || !!r.aiTitle });
    }
    for (const [key, v] of g) if (v.n >= 2 || v.ai) out.push({ kind, key });
  };
  add("game", (await gameRows()).map((t) => ({ key: gameKeyOf(t), aiTitle: t.aiTitle })));
  add("anime", (await animeRows()).map((t) => ({ key: workKey(t.aiAnimeTitle!), aiTitle: t.aiTitle })));
  return out;
}
