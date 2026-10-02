import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/stories/schema";
import { loadEditionView } from "./build";
import { CATEGORY_COLORS, joinHeadline } from "./compose";
import { jstDateLabel, SLOTS, type Slot } from "./slots";

/** トップに出す配信回の新しさ（これより古い回は出さない。次の回までの間隔より少し長く） */
const FRESH_HOURS = 14;

export type DigestSummary = {
  slot: Slot;
  /** この回のページ（/digest/日付/回） */
  href: string;
  title: string;
  dateLabel: string;
  /** 配信した時刻（ISO 文字列） */
  publishedAt: string;
  items: { topicId: number; label: string; color: string; headline: string; point: string; followup: boolean }[];
};

/**
 * 最後に X へ投稿した定時配信の回（サイトのトップで同じ3本を見せる）。
 * 人が承認して投稿した回だけを出し、新しい回がなければ null。
 */
export async function getLatestDigest(now = new Date()): Promise<DigestSummary | null> {
  const edition = await prisma.edition.findFirst({
    where: { status: "PUBLISHED", slot: { not: "BREAKING" }, scheduledAt: { gte: new Date(now.getTime() - FRESH_HOURS * 3_600_000) } },
    orderBy: { scheduledAt: "desc" },
    include: { items: { orderBy: { position: "asc" }, select: { position: true, role: true, storyId: true, override: true } } },
  });
  if (!edition) return null;
  const slot = edition.slot as Slot;
  const [view, stories] = await Promise.all([
    loadEditionView({ ...edition, slot }),
    prisma.story.findMany({ where: { id: { in: edition.items.map((i) => i.storyId) } }, select: { id: true, topicId: true } }),
  ]);
  const topicOf = new Map(stories.map((s) => [s.id, s.topicId]));
  const storyAt = new Map(edition.items.map((i) => [i.position, i.storyId]));
  const items = view.entries.flatMap((e) => {
    const topicId = topicOf.get(storyAt.get(e.position) ?? "");
    if (!topicId) return [];
    const followup = e.role === "FOLLOWUP";
    return [
      {
        topicId,
        label: followup ? "続報" : e.category ? CATEGORY_LABELS[e.category] : "",
        color: e.category ? CATEGORY_COLORS[e.category] : "currentColor",
        headline: joinHeadline(e.headline),
        point: (followup ? e.delta?.now.text : e.points[0]?.text) ?? "",
        followup,
      },
    ];
  });
  if (items.length === 0) return null;
  return {
    slot,
    href: `/digest/${edition.date}/${slot.toLowerCase()}`,
    title: SLOTS[slot].title,
    dateLabel: jstDateLabel(edition.date),
    publishedAt: (edition.publishedAt ?? edition.scheduledAt).toISOString(),
    items,
  };
}

/** 配信してからこの時間までは、トップの一番上に出す（それより後は「いま話題」の下に回す） */
const TOP_HOURS = 3;

/** 配信したばかりの回か（トップの一番上に出すか） */
export function isFreshDigest(d: Pick<DigestSummary, "publishedAt">, now = new Date()): boolean {
  return now.getTime() - new Date(d.publishedAt).getTime() < TOP_HOURS * 3_600_000;
}
