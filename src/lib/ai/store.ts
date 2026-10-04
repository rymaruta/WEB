import { syndicationKey } from "@/lib/coverage";
import { INDEX_MIN_PUBLISHERS } from "@/lib/indexing";
import { submitIndexNow } from "@/lib/indexnow";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { GeneratedArticle } from "./prompt";
import type { BackgroundItem } from "./related";

/** この媒体数以上が報じたトピックだけを対象にする */
export const MIN_PUBLISHERS = Number(process.env.AI_MIN_PUBLISHERS ?? 2);
/** 材料にする記事の最大数 */
const MAX_SOURCES = 12;
/** 失敗・見送り後に再試行するまでの時間 */
const RETRY_AFTER_MS = 6 * 3_600_000;
/** 形式が古い記事（企業名・報じ方・更新履歴がない）を書き直す対象にする期間。今も動きのある話題に限る */
const UPGRADE_WINDOW_HOURS = 48;
/** 作り直す場合も、前回からこの時間は空ける */
const REGENERATE_AFTER_MS = 2 * 3_600_000;
/** 記事を書いた後に、この時間より後の報道が届いていたら書き直す（続報で状況が変わっていることがあるため） */
export const STALE_AFTER_MS = 6 * 3_600_000;

export type TopicSource = {
  id: number;
  publisher: string;
  publishedAt: Date;
  title: string;
  summary: string | null;
  kind: string;
};

/** まとめ記事を作成・更新すべきトピック（話題度の高い順） */
export async function findDueTopics(limit: number, now = Date.now()) {
  const candidates = await prisma.topic.findMany({
    where: {
      lastSeenAt: { gte: new Date(now - 24 * 3_600_000) },
      publisherCount: { gte: MIN_PUBLISHERS },
      // 別の話題にまとめたトピック（記事が残っていない）と、ニュースではない告知は書かない
      mergedIntoId: null,
      aiNotNews: false,
      OR: [{ aiAttemptedAt: null }, { aiAttemptedAt: { lt: new Date(now - REGENERATE_AFTER_MS) } }],
    },
    orderBy: { score: "desc" },
    take: limit * 4,
    select: { id: true, title: true, publisherCount: true, aiGeneratedAt: true, aiAttemptedAt: true, aiSourceCount: true, lastSeenAt: true },
  });
  const due = candidates
    .filter((t) => {
      if (!t.aiGeneratedAt) {
        // 未作成。前回失敗・見送りなら一定時間あける
        return !t.aiAttemptedAt || now - t.aiAttemptedAt.getTime() > RETRY_AFTER_MS;
      }
      // 作成済み。報じる媒体が増えたとき、または記事を書いた後に新しい報道（続報）が届いたときに作り直す
      // （同じ媒体の続報だけでは媒体数が増えず、古い内容のまま残っていた）
      return t.publisherCount > t.aiSourceCount || t.lastSeenAt.getTime() - t.aiGeneratedAt.getTime() > STALE_AFTER_MS;
    })
    .slice(0, limit);
  if (due.length >= limit) return due;

  // 枠が余ったら、さかのぼって書きそびれた話題（独立した報道3社以上で、まとめ記事がない）を書く
  const backfill = await findBackfillTopics(limit - due.length, now, due.map((t) => t.id));
  const filled = [...due, ...backfill];
  if (filled.length >= limit) return filled;

  // それでも余ったら、今の形式になる前に書いた記事（更新の記録がないもの）を、今も動きのある話題から順に書き直す
  return [...filled, ...(await findUpgradeTopics(limit - filled.length, now, filled.map((t) => t.id)))];
}

/** さかのぼって書く期間（日）。記事の保存期間（90日、src/lib/crawl/run.ts）より短くし、消える直前の話題は書かない */
export const BACKFILL_DAYS = 60;

/**
 * さかのぼって書く話題の条件。直近24時間に動きがなくても、独立した報道3社以上（検索エンジンに登録できる記事になる）で、
 * まだまとめ記事がない話題（定期実行が止まっていた間などに書きそびれたもの）。報道機関の記事がない話題は除く
 */
const backfillWhere = (now: number) => ({
  firstSeenAt: { gte: new Date(now - BACKFILL_DAYS * 86_400_000) },
  publisherCount: { gte: INDEX_MIN_PUBLISHERS },
  aiGeneratedAt: null,
  mergedIntoId: null,
  aiNotNews: false,
  articles: { some: { source: { kind: "NEWS" as const } } },
  OR: [{ aiAttemptedAt: null }, { aiAttemptedAt: { lt: new Date(now - RETRY_AFTER_MS) } }],
});

/** さかのぼって書く話題（報じた媒体の多い順） */
export function findBackfillTopics(limit: number, now = Date.now(), excludeIds: number[] = []) {
  if (limit <= 0) return Promise.resolve([]);
  return prisma.topic.findMany({
    where: { ...backfillWhere(now), id: { notIn: excludeIds }, lastSeenAt: { lt: new Date(now - 24 * 3_600_000) } },
    orderBy: [{ publisherCount: "desc" }, { score: "desc" }],
    take: limit,
    select: { id: true, title: true, publisherCount: true, aiGeneratedAt: true, aiAttemptedAt: true, aiSourceCount: true },
  });
}

/** まだまとめ記事のない、書くべきトピックの数（定期処理が書く本数を決める目安）。さかのぼって書く話題も含める */
export async function countNewDueTopics(now = Date.now()) {
  const backfill = await prisma.topic.count({ where: { ...backfillWhere(now), lastSeenAt: { lt: new Date(now - 24 * 3_600_000) } } });
  return backfill + await prisma.topic.count({
    where: {
      lastSeenAt: { gte: new Date(now - 24 * 3_600_000) },
      publisherCount: { gte: MIN_PUBLISHERS },
      aiGeneratedAt: null,
      mergedIntoId: null,
      OR: [{ aiAttemptedAt: null }, { aiAttemptedAt: { lt: new Date(now - RETRY_AFTER_MS) } }],
    },
  });
}

/** 今の形式になる前に書いた記事（更新の記録がないもの）のうち、今も動きのある話題（話題度の高い順） */
export function findUpgradeTopics(limit: number, now = Date.now(), excludeIds: number[] = []) {
  return prisma.topic.findMany({
    where: {
      id: { notIn: excludeIds },
      aiGeneratedAt: { not: null },
      mergedIntoId: null,
      // 今の形式になる前の記事（更新の記録がない）か、ゲームの情報を読み取る前のゲームの記事
      OR: [{ aiHistory: { equals: Prisma.DbNull } }, { aiGameChecked: false, genre: { slug: "game" } }],
      lastSeenAt: { gte: new Date(now - UPGRADE_WINDOW_HOURS * 3_600_000) },
      publisherCount: { gte: MIN_PUBLISHERS },
      // 書き直しが見送られた記事は、しばらく空けてから
      aiAttemptedAt: { lt: new Date(now - RETRY_AFTER_MS) },
    },
    orderBy: { score: "desc" },
    take: limit,
    select: { id: true, title: true, publisherCount: true, aiGeneratedAt: true, aiAttemptedAt: true, aiSourceCount: true },
  });
}

/** 材料にする記事。同じ媒体の記事は最初の1本だけを使う */
export async function loadTopicSources(topicId: number): Promise<TopicSource[]> {
  const articles = await prisma.article.findMany({
    // 収集を止めた媒体（規約で利用が認められていない媒体など）の、止める前の記事は材料にしない
    where: { topicId, source: { active: true } },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: { id: true, publisher: true, publishedAt: true, title: true, summary: true, source: { select: { kind: true } } },
  });
  return pickSources(articles.map(({ source, ...a }) => ({ ...a, kind: source.kind })));
}

/** 材料のうち、新しい報道に回す数（続報で状況が変わったときに、最新の内容が材料から漏れないように） */
const LATEST_SOURCES = 5;

/**
 * 材料にする記事を選ぶ（古い順に並べて返す）。
 * - 新しい報道を LATEST_SOURCES 本（同じ見出しの転載は1本と数える）。続報で状況が変わった話題でも、最新の内容を材料に入れる
 * - 残りは、媒体ごとの最初の記事を古い順に（第一報と、各社の報じ方の違いを残す）
 * 以前は「媒体ごとの最初の記事を古い順に12本」だったため、長く続く話題では最新の報道が材料に入らず、古い内容のまま書かれていた
 */
export function pickSources<T extends { id: number; publisher: string; publishedAt: Date; title: string }>(articles: T[], max = MAX_SOURCES): T[] {
  const asc = [...articles].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime() || a.id - b.id);
  const key = (a: T) => syndicationKey(a.title, a.publisher);
  const picked = new Map<number, T>();
  const keys = new Set<string>();
  const take = (a: T) => {
    if (picked.size >= max || picked.has(a.id) || keys.has(key(a))) return;
    picked.set(a.id, a);
    keys.add(key(a));
  };
  // 第一報は必ず入れる
  if (asc[0]) take(asc[0]);
  for (const a of [...asc].reverse()) {
    if (picked.size >= Math.min(LATEST_SOURCES + 1, max)) break;
    take(a);
  }
  const seenPublisher = new Set([...picked.values()].map((a) => a.publisher));
  for (const a of asc) {
    if (seenPublisher.has(a.publisher)) continue;
    seenPublisher.add(a.publisher);
    take(a);
  }
  return asc.filter((a) => picked.has(a.id));
}

export function markAttempted(topicId: number) {
  return prisma.topic.update({ where: { id: topicId }, data: { aiAttemptedAt: new Date() } });
}

/** 検証済みのまとめ記事を保存する。sourceIds は出典番号 1, 2, ... に対応する記事 ID */
export async function saveArticle(topicId: number, article: GeneratedArticle, sourceIds: number[], model: string, background: BackgroundItem[] = []) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: { publisherCount: true, aiHistory: true, aiGeneratedAt: true, aiSourceCount: true },
  });
  const now = new Date();
  // 記録を始める前に書いた記事を書き直すときは、最初に作成した時点を履歴の先頭に残す
  const earlier =
    !Array.isArray(topic.aiHistory) && topic.aiGeneratedAt ? [{ at: topic.aiGeneratedAt.toISOString(), sources: topic.aiSourceCount }] : [];
  // 作成・更新の記録を残す（記事を黙って書き換えず、いつ・なぜ更新したかを読者に示す）
  const history = [...(Array.isArray(topic.aiHistory) ? topic.aiHistory : earlier), { at: now.toISOString(), sources: sourceIds.length }].slice(-20);
  // AI が内容から判定したジャンルがあれば、トピックのジャンルとして使う（媒体の欄による誤りを直す）
  const genre = article.genre ? await prisma.genre.findUnique({ where: { slug: article.genre }, select: { id: true } }) : null;
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      aiTitle: article.title,
      aiLead: article.lead,
      aiBody: article.body.join("\n\n"),
      aiPoints: article.points,
      aiWhy: article.why ?? Prisma.DbNull,
      aiAngles: article.angles ?? [],
      aiBackground: background,
      aiCompanies: article.companies ?? [],
      aiMarketEvent: article.marketEvent ?? null,
      aiGameTitle: article.game?.title ?? null,
      aiGameKey: article.game?.titleKey?.trim() || null,
      aiGameRelease: article.game?.releaseDate ?? null,
      aiGameKind: article.game?.kind ?? null,
      aiGamePlatforms: article.game?.platforms ?? [],
      // game を書く形式で送られた記事だけ「確認済み」にする（以前の形式の記事は、書き直しの対象に残す）
      aiGameChecked: article.game !== undefined,
      aiSources: sourceIds,
      aiModel: model,
      aiHistory: history,
      aiGeneratedAt: now,
      aiAttemptedAt: now,
      aiSourceCount: topic.publisherCount,
      // ジャンルを決めた記録（genre-apply.ts の「ai」と同じ扱い。ルールでは変えず、強く食い違うときだけ見直しを頼む）
      ...(genre ? { aiGenreId: genre.id, genreId: genre.id, genreNote: `ai ${article.genre} （まとめ記事の作成時）` } : {}),
    },
  });
  // 版を残す（記事を書き直しても、前の内容を確かめられるように）
  await prisma.topicArticleVersion.create({
    data: { topicId, title: article.title, lead: article.lead, body: article.body.join("\n\n"), points: article.points, sources: sourceIds, model },
  });
  // まとめ記事を書いた・更新したページを、検索エンジンにすぐ知らせる（待たない）
  void submitIndexNow([`/topic/${topicId}`]);
}
