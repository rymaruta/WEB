import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { isSameEvent, type Entities } from "./dedup";
import { HOT, isHot } from "./hot";
import { pickFollowupMaterials, pickMaterials, type ArticleRef } from "./materials";
import type { FollowupAnalysis, PreviousCoverage, Sourced, StoryAnalysis, StoryMaterial } from "./schema";
import { verifyAnalysis, verifyFollowup } from "./verify";

/** この媒体数以上が報じたトピックを候補にする（1媒体だけのニュースは配信しない） */
const MIN_PUBLISHERS = 2;
/** 候補にするトピックの新しさ */
const CANDIDATE_HOURS = 24;
/** 重複・続報の照合に使う過去の範囲 */
const DEDUP_HOURS = 72;
/** 配信済みのストーリーに新しい記事が届いたとき、続報の候補にする期間 */
const FOLLOWUP_HOURS = 36;

async function topicArticles(topicId: number): Promise<ArticleRef[]> {
  const rows = await prisma.article.findMany({
    // 収集を止めた媒体の、止める前の記事は材料にしない（src/lib/ai/store.ts の loadTopicSources と同じ）
    where: { topicId, source: { active: true } },
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    select: { id: true, publisher: true, publishedAt: true, source: { select: { kind: true } } },
  });
  return rows.map((a) => ({ id: a.id, publisher: a.publisher, publishedAt: a.publishedAt, isPrimary: a.source.kind === "PRESS" }));
}

function sourcesCreate(picked: ArticleRef[]) {
  return { create: picked.map((a, i) => ({ position: i + 1, articleId: a.id, publisher: a.publisher, isPrimary: a.isPrimary })) };
}

/**
 * 候補を登録する。
 * - 新しく話題になったトピック → 通常のストーリー（解析待ち QUEUED）
 * - 配信済みのトピックに新しい記事が届いた → 続報のストーリー（差分の解析待ち DELTA_QUEUED）
 */
export async function enqueueCandidates(limit: number, now = Date.now()): Promise<{ created: number; followups: number }> {
  const topics = await prisma.topic.findMany({
    where: {
      lastSeenAt: { gte: new Date(now - CANDIDATE_HOURS * 3_600_000) },
      publisherCount: { gte: MIN_PUBLISHERS },
      // ほかの話題にまとめた話題と、ニュースではない告知は配信の候補にしない
      mergedIntoId: null,
      aiNotNews: false,
      stories: { none: {} },
    },
    orderBy: { score: "desc" },
    take: limit,
    select: { id: true, score: true },
  });
  // 速報になりうる出来事は、1媒体だけの報道でもすぐに候補にする（媒体がそろうのを待たない。src/lib/stories/hot.ts）
  const recent = await prisma.topic.findMany({
    where: { firstSeenAt: { gte: new Date(now - HOT.withinHours * 3_600_000) }, publisherCount: { lt: MIN_PUBLISHERS }, mergedIntoId: null, aiNotNews: false, stories: { none: {} } },
    orderBy: { firstSeenAt: "desc" },
    take: 300,
    select: { id: true, score: true, title: true, publisherCount: true, firstSeenAt: true, lastSeenAt: true },
  });
  const hot = recent.filter((t) => isHot(t, now)).slice(0, limit);
  let created = 0;
  for (const t of [...hot, ...topics]) {
    const picked = pickMaterials(await topicArticles(t.id));
    try {
      await prisma.story.create({ data: { topicId: t.id, score: t.score, sources: sourcesCreate(picked) } });
      created++;
    } catch {
      // 同時に登録された場合（topicId と revision の一意制約）は何もしない
    }
  }
  return { created, followups: await enqueueTopicFollowups(now) };
}

/** 配信済みのストーリーのトピックに、配信後の記事が届いていれば続報の候補にする */
async function enqueueTopicFollowups(now: number): Promise<number> {
  const published = await prisma.story.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: new Date(now - FOLLOWUP_HOURS * 3_600_000) } },
    select: {
      id: true,
      topicId: true,
      revision: true,
      publishedAt: true,
      eventThreadId: true,
      category: true,
      riskFlags: true,
      keyword: true,
      score: true,
      sources: { select: { articleId: true } },
    },
  });
  let created = 0;
  for (const s of published) {
    // 最新の回だけを対象にする（続報の続報は、続報が配信された後に作る）
    const newer = await prisma.story.count({ where: { topicId: s.topicId, revision: { gt: s.revision } } });
    if (newer > 0 || !s.publishedAt) continue;
    const used = new Set(s.sources.map((x) => x.articleId));
    const picked = pickFollowupMaterials(await topicArticles(s.topicId), s.publishedAt, used);
    if (!picked) continue;
    try {
      await prisma.story.create({
        data: {
          topicId: s.topicId,
          revision: s.revision + 1,
          kind: "FOLLOWUP",
          followupOf: s.id,
          eventThreadId: s.eventThreadId,
          status: "DELTA_QUEUED",
          category: s.category,
          riskFlags: s.riskFlags,
          keyword: s.keyword,
          score: s.score,
          sources: sourcesCreate(picked),
        },
      });
      created++;
    } catch {
      // 同時に登録された場合は何もしない
    }
  }
  return created;
}

/** 国内・国際・経済の話題は、解析の順番で話題度を1.5倍に見る（朝・夜の配信は政治・経済・国際を1本以上載せるため） */
const HARD_NEWS_GENRES = new Set(["domestic", "world", "business"]);
const HARD_NEWS_BOOST = 1.5;

/**
 * 解析待ちのストーリー。話題度（媒体数・SNS の反応・新しさ）の高い順で、国内・国際・経済を少し優先する。
 * 完全に国内・国際・経済を先にすると、話題性の高い芸能・スポーツの出来事がいつまでも解析されないため、倍率で優先する。
 */
export async function findQueued(limit: number) {
  const select = { id: true, topicId: true, score: true, topic: { select: { genre: { select: { slug: true } } } } } as const;
  const [rows, hot] = await Promise.all([
    prisma.story.findMany({ where: { status: "QUEUED" }, orderBy: { score: "desc" }, take: limit * 5, select }),
    // 速報になりうる出来事は、分野や話題度の数値によらず先に解析する
    findHotQueued(limit),
  ]);
  const priority = (r: (typeof rows)[number]) => r.score * (HARD_NEWS_GENRES.has(r.topic.genre?.slug ?? "") ? HARD_NEWS_BOOST : 1);
  const first = new Set(hot.map((r) => r.id));
  return [...hot, ...rows.filter((r) => !first.has(r.id)).sort((a, b) => priority(b) - priority(a))]
    .slice(0, limit)
    .map(({ id, topicId }) => ({ id, topicId }));
}

/** 解析待ちのうち、速報になりうる出来事（src/lib/stories/hot.ts）。速報用の解析はこれだけを先に解析する */
export async function findHotQueued(limit: number, minPublishers = 1, keep: (title: string) => boolean = () => true) {
  const now = Date.now();
  const rows = await prisma.story.findMany({
    where: { status: "QUEUED", topic: { firstSeenAt: { gte: new Date(now - HOT.withinHours * 3_600_000) }, publisherCount: { gte: minPublishers } } },
    orderBy: { topic: { publisherCount: "desc" } },
    take: 200,
    select: { id: true, topicId: true, topic: { select: { title: true, publisherCount: true, firstSeenAt: true, lastSeenAt: true } } },
  });
  return rows
    .filter((s) => isHot(s.topic, now) && keep(s.topic.title))
    .slice(0, limit)
    .map(({ id, topicId }) => ({ id, topicId }));
}

/** 続報の差分の解析待ち */
export function findDeltaQueued(limit: number) {
  return prisma.story.findMany({ where: { status: "DELTA_QUEUED" }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true, topicId: true } });
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

/** 続報のストーリーについて、前回の配信の内容を読む */
export async function loadPreviousCoverage(storyId: string): Promise<PreviousCoverage | null> {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { followupOf: true } });
  if (!story?.followupOf) return null;
  const prev = await prisma.story.findUnique({ where: { id: story.followupOf } });
  if (!prev) return null;
  return {
    keyword: prev.keyword ?? prev.shortTitle ?? "",
    headline: prev.headline,
    summary: prev.summary ?? "",
    points: ((prev.points as Sourced[] | null) ?? []).map((p) => p.text),
    publishedAt: prev.publishedAt ?? prev.analyzedAt ?? prev.createdAt,
  };
}

/** 同じ出来事のストーリーを探す（過去72時間、配信候補として生きているもの） */
async function findSameEvent(storyId: string, entities: Entities, at: Date) {
  const others = await prisma.story.findMany({
    where: {
      id: { not: storyId },
      createdAt: { gte: new Date(at.getTime() - DEDUP_HOURS * 3_600_000) },
      status: { in: ["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, entities: true, createdAt: true, eventThreadId: true },
  });
  return others.find((o) => o.entities && isSameEvent(entities, o.entities as unknown as Entities, at, o.createdAt)) ?? null;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * AI の解析結果を照合して保存する。状態もここで決まる。
 * - 照合で問題なし → PENDING、要確認 → REVIEW_REQUIRED、資料不足 → REJECTED_AUTO
 * - 同じ出来事の候補が既にある → 重複として除外
 * - 同じ出来事が既に配信済み → 続報として差分の解析に回す（DELTA_QUEUED）
 */
export async function applyAnalysis(storyId: string, analysis: StoryAnalysis, provider: string, model: string) {
  const story = await prisma.story.findUniqueOrThrow({ where: { id: storyId }, select: { createdAt: true } });
  const materials = await loadMaterials(storyId);
  const result = verifyAnalysis(analysis, materials);
  let status: "PENDING" | "REVIEW_REQUIRED" | "REJECTED_AUTO" | "DELTA_QUEUED" = result.status;
  const notes = [...result.notes];
  const c = result.cleaned;
  let duplicateOf: string | null = null;
  let followupOf: string | null = null;
  let eventThreadId: string | null = null;

  if (status !== "REJECTED_AUTO") {
    const same = await findSameEvent(storyId, c.entities, story.createdAt);
    if (same?.status === "PUBLISHED") {
      status = "DELTA_QUEUED";
      followupOf = same.id;
      eventThreadId = same.eventThreadId;
      notes.unshift(`配信済みの出来事の続報（${same.id}）`);
    } else if (same) {
      status = "REJECTED_AUTO";
      duplicateOf = same.id;
      notes.unshift(`同じ出来事の候補が既にある（${same.id}）`);
    } else {
      eventThreadId = (await prisma.eventThread.create({ data: { title: c.shortTitle || c.headline.join("") } })).id;
    }
  }

  await prisma.$transaction([
    prisma.storyAnalysis.create({
      data: {
        storyId,
        task: "story",
        provider,
        model,
        output: json(analysis),
        checks: json({ status, notes, missingFacts: result.missingFacts }),
        accepted: status !== "REJECTED_AUTO",
      },
    }),
    prisma.story.update({
      where: { id: storyId },
      data: {
        status,
        statusNote: notes.join("\n") || null,
        kind: followupOf ? "FOLLOWUP" : "NEW",
        followupOf,
        eventThreadId,
        category: c.category,
        cardType: c.cardType,
        importance: c.importance,
        riskFlags: c.riskFlags,
        headline: c.headline,
        shortTitle: c.shortTitle,
        keyword: c.keyword,
        summary: c.summary,
        points: json(c.points),
        why: c.why ? json(c.why) : undefined,
        assessment: json(c.assessment),
        entities: json(c.entities),
        eventTime: c.eventTime,
        conflicts: json(c.conflicts),
        confidence: c.confidence,
        duplicateOf,
        analyzedAt: new Date(),
      },
    }),
  ]);
  await logEvent(status === "REJECTED_AUTO" ? "warn" : "info", "story.analyze", status, storyId, { provider, model, notes });
  return { status, notes };
}

/** 続報の差分を照合して保存する。新しい事実がなければ除外する */
export async function applyFollowup(storyId: string, analysis: FollowupAnalysis, provider: string, model: string) {
  const previous = await loadPreviousCoverage(storyId);
  if (!previous) throw new Error(`前回のストーリーが見つからない: ${storyId}`);
  const result = verifyFollowup(analysis, await loadMaterials(storyId), previous);
  const c = result.cleaned;
  await prisma.$transaction([
    prisma.storyAnalysis.create({
      data: {
        storyId,
        task: "followup",
        provider,
        model,
        output: json(analysis),
        checks: json({ status: result.status, notes: result.notes, missingFacts: result.missingFacts }),
        accepted: result.status !== "REJECTED_AUTO",
      },
    }),
    prisma.story.update({
      where: { id: storyId },
      data: {
        status: result.status,
        statusNote: result.notes.join("\n") || null,
        kind: "FOLLOWUP",
        keyword: previous.keyword,
        headline: [previous.keyword, "結局どうなった"],
        shortTitle: c.shortTitle,
        delta: json({ before: c.before, now: c.now, newFacts: c.newFacts }),
        confidence: c.confidence,
        analyzedAt: new Date(),
      },
    }),
  ]);
  await logEvent(result.status === "REJECTED_AUTO" ? "warn" : "info", "story.followup", result.status, storyId, { provider, model, notes: result.notes });
  return { status: result.status, notes: result.notes };
}
