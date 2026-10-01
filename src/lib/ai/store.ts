import { prisma } from "@/lib/db";
import type { GeneratedArticle } from "./prompt";

/** この媒体数以上が報じたトピックだけを対象にする */
export const MIN_PUBLISHERS = Number(process.env.AI_MIN_PUBLISHERS ?? 2);
/** 材料にする記事の最大数 */
const MAX_SOURCES = 12;
/** 失敗・見送り後に再試行するまでの時間 */
const RETRY_AFTER_MS = 6 * 3_600_000;
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
  return candidates
    .filter((t) => {
      if (!t.aiGeneratedAt) {
        // 未作成。前回失敗・見送りなら一定時間あける
        return !t.aiAttemptedAt || now - t.aiAttemptedAt.getTime() > RETRY_AFTER_MS;
      }
      // 作成済み。報じる媒体が増えたときだけ作り直す
      return t.publisherCount > t.aiSourceCount;
    })
    .slice(0, limit);
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
  const topic = await prisma.topic.findUniqueOrThrow({ where: { id: topicId }, select: { publisherCount: true } });
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
      aiSources: sourceIds,
      aiModel: model,
      aiGeneratedAt: new Date(),
      aiAttemptedAt: new Date(),
      aiSourceCount: topic.publisherCount,
      ...(genre ? { aiGenreId: genre.id, genreId: genre.id } : {}),
    },
  });
}
