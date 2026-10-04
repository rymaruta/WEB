import { isAdSensitive } from "@/lib/ad-eligibility";
import { META_SENTENCE } from "@/lib/ai/article";
import { prisma } from "@/lib/db";
import { INDEX_MIN_POINTS } from "@/lib/indexing";
import { titleConflict } from "@/lib/topics/conflict";
import { STALE_AFTER_MS } from "@/lib/ai/store";

/**
 * 編集部の点検。検索エンジンに登録するまとめ記事を、人が管理画面で確かめる（/admin/review）。
 * - プログラムは、点検の手がかり（古いおそれ・要点が少ない・別の出来事が混ざったおそれ など）を付けて並べるだけ
 * - 確認済み・検索から外す・書き直しを決めるのは人。人が確認した記事にだけ「編集部が確認」と表示する
 *   （AI や自動の照合だけで「確認済み」とは表示しない）
 * - 確認の後に記事を書き直したら、確認は古くなる（もう一度点検の対象になる）
 */

export type ReviewStatus = "ok" | "hold";

export type ReviewFlag = "stale" | "fewPoints" | "mixed" | "metaText" | "sensitive";

export const REVIEW_FLAG_LABELS: Record<ReviewFlag, string> = {
  stale: "記事を書いた後に新しい報道あり（古いおそれ）",
  fewPoints: `要点が${INDEX_MIN_POINTS}つ未満`,
  mixed: "別の人・別の大会の記事が混ざったおそれ",
  metaText: "「資料には…」など読者向けでない文",
  sensitive: "死傷・事件など（広告は出していない）",
};

export type ReviewInput = {
  title: string;
  aiTitle: string | null;
  aiLead: string | null;
  aiBody: string | null;
  aiPoints: unknown;
  aiGeneratedAt: Date | null;
  lastSeenAt: Date;
  articleTitles: string[];
};

/** 点検の手がかり（DB に依存しない） */
export function reviewFlags(t: ReviewInput): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  if (t.aiGeneratedAt && t.lastSeenAt.getTime() - t.aiGeneratedAt.getTime() > STALE_AFTER_MS) flags.push("stale");
  const points = Array.isArray(t.aiPoints) ? t.aiPoints.length : 0;
  if (points < INDEX_MIN_POINTS) flags.push("fewPoints");
  if (t.articleTitles.some((title, i) => titleConflict(title, t.articleTitles.filter((_, j) => j !== i)))) flags.push("mixed");
  const raw = [t.aiLead, t.aiBody, JSON.stringify(t.aiPoints ?? "")].join("\n");
  if (META_SENTENCE.test(raw)) flags.push("metaText");
  if (isAdSensitive(t.title, t.aiTitle, t.aiLead)) flags.push("sensitive");
  return flags;
}

/** 人の確認がいまの記事に対して有効か（確認の後に書き直していないか） */
export function isReviewCurrent(t: { reviewStatus: string | null; reviewedAt: Date | null; aiGeneratedAt: Date | null }): boolean {
  return t.reviewStatus === "ok" && !!t.reviewedAt && !!t.aiGeneratedAt && t.reviewedAt.getTime() >= t.aiGeneratedAt.getTime();
}

/** 点検の対象（直近 days 日に書いた記事のうち、まだ確認していないもの・確認の後に書き直したもの）。手がかりの多い順 */
export async function getReviewQueue(limit = 50, days = 14, now = new Date()) {
  const topics = await prisma.topic.findMany({
    where: {
      aiGeneratedAt: { gte: new Date(now.getTime() - days * 86_400_000) },
      mergedIntoId: null,
      OR: [{ reviewStatus: null }, { reviewStatus: "ok" }],
    },
    orderBy: { aiGeneratedAt: "desc" },
    take: 400,
    select: {
      id: true,
      title: true,
      aiTitle: true,
      aiLead: true,
      aiBody: true,
      aiPoints: true,
      aiGeneratedAt: true,
      lastSeenAt: true,
      publisherCount: true,
      reviewStatus: true,
      reviewedAt: true,
      articles: { select: { title: true }, take: 40 },
    },
  });
  return topics
    .filter((t) => !isReviewCurrent(t))
    .map((t) => ({ ...t, flags: reviewFlags({ ...t, articleTitles: t.articles.map((a) => a.title) }) }))
    .sort((a, b) => b.flags.length - a.flags.length || b.publisherCount - a.publisherCount)
    .slice(0, limit);
}

/** 点検の結果を残す。書き直しを頼むときは、次のまとめ記事の作成で書き直す（aiSourceCount を 0 にして対象に入れる） */
export async function saveReview(topicId: number, action: "ok" | "hold" | "rewrite", note: string | null, now = new Date()) {
  if (action === "rewrite") {
    return prisma.topic.update({ where: { id: topicId }, data: { aiSourceCount: 0, aiAttemptedAt: null, reviewNote: note } });
  }
  return prisma.topic.update({ where: { id: topicId }, data: { reviewStatus: action, reviewedAt: now, reviewNote: note } });
}
