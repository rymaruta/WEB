import { isAdSensitive } from "@/lib/ad-eligibility";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { StoredExplainer } from "./explainer";

/** 解説を書く対象：この日数以内にまとめ記事を書いた話題 */
const EXPLAIN_WITHIN_DAYS = 3;
/** 報じた媒体がこの数以上の話題（多くの人が目にする話題から書く） */
const EXPLAIN_MIN_PUBLISHERS = 2;

/**
 * 「◯◯とは」を書くべき話題（話題度の高い順）。
 * まとめ記事があり、まだ解説を試みていない話題。事件・事故・訃報など（広告を出さない話題と同じ判定）は扱わない
 */
export async function findExplainerTopics(limit: number, now = Date.now()) {
  const rows = await prisma.topic.findMany({
    where: {
      aiGeneratedAt: { gte: new Date(now - EXPLAIN_WITHIN_DAYS * 86_400_000) },
      aiExplainAttemptedAt: null,
      publisherCount: { gte: EXPLAIN_MIN_PUBLISHERS },
      mergedIntoId: null,
      aiNotNews: false,
      OR: [{ reviewStatus: null }, { reviewStatus: { not: "hold" } }],
    },
    orderBy: { score: "desc" },
    take: limit * 3,
    select: { id: true, title: true, aiTitle: true, aiLead: true, aiPoints: true, genre: { select: { name: true } } },
  });
  return rows.filter((t) => !isAdSensitive(t.title, t.aiTitle, t.aiLead)).slice(0, limit);
}

/** 解説を保存する（書けなかったときは試みた時刻だけを残す） */
export async function saveExplainer(topicId: number, explainer: StoredExplainer | null, now = new Date()) {
  return prisma.topic.update({
    where: { id: topicId },
    data: explainer
      ? { aiExplainer: explainer as unknown as Prisma.InputJsonValue, aiExplainedAt: now, aiExplainAttemptedAt: now }
      : { aiExplainAttemptedAt: now },
    select: { id: true },
  });
}
