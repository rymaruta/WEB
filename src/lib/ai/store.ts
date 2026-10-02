import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { GeneratedArticle } from "./prompt";

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
      OR: [{ aiAttemptedAt: null }, { aiAttemptedAt: { lt: new Date(now - REGENERATE_AFTER_MS) } }],
    },
    orderBy: { score: "desc" },
    take: limit * 4,
    select: { id: true, title: true, publisherCount: true, aiGeneratedAt: true, aiAttemptedAt: true, aiSourceCount: true },
  });
  const due = candidates
    .filter((t) => {
      if (!t.aiGeneratedAt) {
        // 未作成。前回失敗・見送りなら一定時間あける
        return !t.aiAttemptedAt || now - t.aiAttemptedAt.getTime() > RETRY_AFTER_MS;
      }
      // 作成済み。報じる媒体が増えたときだけ作り直す
      return t.publisherCount > t.aiSourceCount;
    })
    .slice(0, limit);
  if (due.length >= limit) return due;

  // 枠が余ったら、今の形式になる前に書いた記事（更新の記録がないもの）を、今も動きのある話題から順に書き直す
  return [...due, ...(await findUpgradeTopics(limit - due.length, now, due.map((t) => t.id)))];
}

/** 今の形式になる前に書いた記事（更新の記録がないもの）のうち、今も動きのある話題（話題度の高い順） */
export function findUpgradeTopics(limit: number, now = Date.now(), excludeIds: number[] = []) {
  return prisma.topic.findMany({
    where: {
      id: { notIn: excludeIds },
      aiGeneratedAt: { not: null },
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
    where: { topicId },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: { id: true, publisher: true, publishedAt: true, title: true, summary: true, source: { select: { kind: true } } },
  });
  const seen = new Set<string>();
  return articles
    .filter((a) => (seen.has(a.publisher) ? false : (seen.add(a.publisher), true)))
    .slice(0, MAX_SOURCES)
    .map(({ source, ...a }) => ({ ...a, kind: source.kind }));
}

export function markAttempted(topicId: number) {
  return prisma.topic.update({ where: { id: topicId }, data: { aiAttemptedAt: new Date() } });
}

/** 検証済みのまとめ記事を保存する。sourceIds は出典番号 1, 2, ... に対応する記事 ID */
export async function saveArticle(topicId: number, article: GeneratedArticle, sourceIds: number[], model: string) {
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
      aiAngles: article.angles ?? [],
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
      ...(genre ? { aiGenreId: genre.id, genreId: genre.id } : {}),
    },
  });
}
