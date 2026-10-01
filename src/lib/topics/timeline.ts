import { cache } from "react";
import { prisma } from "@/lib/db";
import { pickAround } from "./pick-around";

export type TimelineEntry = {
  id: number;
  title: string;
  firstSeenAt: Date;
  publisherCount: number;
};

/** 経緯として並べる話題の上限（古いものから順に表示する） */
const MAX_ENTRIES = 12;

/**
 * 同じ出来事を扱う話題を、最初の報道の古い順に返す（この話題を含む）。
 *
 * ストーリー解析で「同じ出来事」と判定されたもの（EventThread）と、その重複として
 * 除外されたストーリーの話題をたどる。関連する話題が他にないときは空配列。
 */
export const getEventTimeline = cache(async (topicId: number): Promise<TimelineEntry[]> => {
  const own = await prisma.story.findMany({
    where: { topicId },
    select: { eventThreadId: true, duplicateOf: true },
  });
  const threadIds = new Set(own.map((s) => s.eventThreadId).filter((t): t is string => !!t));
  const dupOf = own.map((s) => s.duplicateOf).filter((d): d is string => !!d);
  if (dupOf.length) {
    const originals = await prisma.story.findMany({ where: { id: { in: dupOf } }, select: { eventThreadId: true } });
    for (const o of originals) if (o.eventThreadId) threadIds.add(o.eventThreadId);
  }
  if (!threadIds.size) return [];

  const inThread = await prisma.story.findMany({
    where: { eventThreadId: { in: [...threadIds] } },
    select: { id: true, topicId: true },
  });
  const duplicates = await prisma.story.findMany({
    where: { duplicateOf: { in: inThread.map((s) => s.id) } },
    select: { topicId: true },
  });
  const topicIds = new Set([topicId, ...inThread.map((s) => s.topicId), ...duplicates.map((s) => s.topicId)]);
  if (topicIds.size < 2) return [];

  const topics = await prisma.topic.findMany({
    where: { id: { in: [...topicIds] } },
    select: { id: true, title: true, aiTitle: true, firstSeenAt: true, publisherCount: true },
    orderBy: [{ firstSeenAt: "asc" }, { id: "asc" }],
  });
  return pickAround(
    topics.map((t) => ({ id: t.id, title: t.aiTitle ?? t.title, firstSeenAt: t.firstSeenAt, publisherCount: t.publisherCount })),
    topicId,
    MAX_ENTRIES,
  );
});
