import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { isSameEvent, type Entities } from "./dedup";
import type { StoryAnalysis, StoryMaterial } from "./schema";
import { verifyAnalysis } from "./verify";

/** この媒体数以上が報じたトピックを候補にする（1媒体だけのニュースは投稿しない） */
const MIN_PUBLISHERS = 2;
/** 候補にするトピックの新しさ */
const CANDIDATE_HOURS = 24;
/** AI に渡す資料の最大数（同じ媒体は1本だけ） */
const MAX_MATERIALS = 10;
/** 重複の照合に使う過去の範囲 */
const DEDUP_HOURS = 72;

/** 新しく話題になったトピックをストーリーとして登録する（解析待ち QUEUED） */
export async function enqueueCandidates(limit: number, now = Date.now()): Promise<number> {
  const topics = await prisma.topic.findMany({
    where: {
      lastSeenAt: { gte: new Date(now - CANDIDATE_HOURS * 3_600_000) },
      publisherCount: { gte: MIN_PUBLISHERS },
      story: null,
    },
    orderBy: { score: "desc" },
    take: limit,
    select: { id: true, score: true },
  });
  let created = 0;
  for (const t of topics) {
    const articles = await prisma.article.findMany({
      where: { topicId: t.id },
      orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
      select: { id: true, publisher: true, source: { select: { kind: true } } },
    });
    const seen = new Set<string>();
    const picked = articles.filter((a) => (seen.has(a.publisher) ? false : (seen.add(a.publisher), true))).slice(0, MAX_MATERIALS);
    try {
      await prisma.story.create({
        data: {
          topicId: t.id,
          score: t.score,
          sources: {
            create: picked.map((a, i) => ({ position: i + 1, articleId: a.id, publisher: a.publisher, isPrimary: a.source.kind === "PRESS" })),
          },
        },
      });
      created++;
    } catch {
      // 同時に登録された場合（topicId の一意制約）は何もしない
    }
  }
  return created;
}

/** 解析待ちのストーリー（話題度の高い順） */
export function findQueued(limit: number) {
  return prisma.story.findMany({ where: { status: "QUEUED" }, orderBy: { score: "desc" }, take: limit, select: { id: true, topicId: true } });
}

/** ストーリーの資料（番号付き） */
export async function loadMaterials(storyId: string): Promise<StoryMaterial[]> {
  const sources = await prisma.storySource.findMany({ where: { storyId }, orderBy: { position: "asc" } });
  const articles = await prisma.article.findMany({
    where: { id: { in: sources.map((s) => s.articleId) } },
    select: { id: true, title: true, summary: true, publishedAt: true },
  });
  const byId = new Map(articles.map((a) => [a.id, a]));
  return sources.flatMap((s) => {
    const a = byId.get(s.articleId);
    return a ? [{ position: s.position, publisher: s.publisher, publishedAt: a.publishedAt, title: a.title, summary: a.summary, isPrimary: s.isPrimary }] : [];
  });
}

/** 同じ出来事のストーリーが既にあるか（過去72時間、投稿候補として生きているもの） */
async function findDuplicate(storyId: string, entities: Entities, at: Date): Promise<string | null> {
  const others = await prisma.story.findMany({
    where: {
      id: { not: storyId },
      createdAt: { gte: new Date(at.getTime() - DEDUP_HOURS * 3_600_000) },
      status: { in: ["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"] },
    },
    select: { id: true, entities: true, createdAt: true },
  });
  for (const o of others) {
    if (o.entities && isSameEvent(entities, o.entities as unknown as Entities, at, o.createdAt)) return o.id;
  }
  return null;
}

/** AI の解析結果を照合して保存する。状態（承認待ち・要確認・自動除外）もここで決まる */
export async function applyAnalysis(storyId: string, analysis: StoryAnalysis, provider: string, model: string) {
  const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId }, select: { createdAt: true } });
  const materials = await loadMaterials(storyId);
  const result = verifyAnalysis(analysis, materials);
  let { status } = result;
  const notes = [...result.notes];
  let duplicateOf: string | null = null;
  if (status !== "REJECTED_AUTO") {
    duplicateOf = await findDuplicate(storyId, result.cleaned.entities, story.createdAt);
    if (duplicateOf) {
      status = "REJECTED_AUTO";
      notes.unshift(`同じ出来事のストーリーが既にある（${duplicateOf}）`);
    }
  }
  const c = result.cleaned;
  await prisma.$transaction([
    prisma.storyAnalysis.create({
      data: {
        storyId,
        provider,
        model,
        output: analysis as unknown as Prisma.InputJsonValue,
        checks: { status, notes, missingFacts: result.missingFacts } as Prisma.InputJsonValue,
        accepted: status !== "REJECTED_AUTO",
      },
    }),
    prisma.story.update({
      where: { id: storyId },
      data: {
        status,
        statusNote: notes.join("\n") || null,
        category: c.category,
        cardType: c.cardType,
        importance: c.importance,
        riskFlags: c.riskFlags,
        headline: c.headline,
        summary: c.summary,
        points: c.points as unknown as Prisma.InputJsonValue,
        entities: c.entities as unknown as Prisma.InputJsonValue,
        eventTime: c.eventTime,
        conflicts: c.conflicts as unknown as Prisma.InputJsonValue,
        postText: c.postLines,
        confidence: c.confidence,
        duplicateOf,
        analyzedAt: new Date(),
      },
    }),
  ]);
  await logEvent(status === "REJECTED_AUTO" ? "warn" : "info", "story.analyze", `${status}`, storyId, { provider, model, notes });
  return { status, notes };
}
