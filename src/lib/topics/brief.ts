import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { TimelineEntry } from "./timeline";

/**
 * 話題ページの冒頭に出す「3行でわかる」。何が起きたか・なぜ重要か・その後どうなったかを1画面で示す。
 * どれも、照合を通った文章（まとめ記事のリード・配信候補の「なぜ重要」）と、同じ出来事の流れ（timeline）だけから作る
 */
export type TopicBrief = {
  what: string;
  why: string | null;
  /** この話題より後の、同じ出来事の最新の話題（続報） */
  next: { id: number; title: string; at: Date } | null;
};

/** なぜ重要かは、照合を通った配信候補（人の確認が要るもの・却下したものは除く）の文章だけを使う */
const WHY_STATUSES = ["PENDING", "APPROVED", "PUBLISHED"] as const;

export async function getTopicWhy(topicId: number): Promise<string | null> {
  const story = await prisma.story.findFirst({
    where: { topicId, status: { in: [...WHY_STATUSES] }, why: { not: Prisma.AnyNull } },
    orderBy: { createdAt: "desc" },
    select: { why: true },
  });
  const why = story?.why as { text?: unknown } | null | undefined;
  return typeof why?.text === "string" && why.text.trim() ? why.text.trim() : null;
}

/** 3行の材料をまとめる（DB に依存しない） */
export function buildBrief(lead: string | null | undefined, why: string | null, timeline: TimelineEntry[], current: { id: number; firstSeenAt: Date }): TopicBrief | null {
  if (!lead?.trim()) return null;
  const later = timeline.filter((e) => e.id !== current.id && e.firstSeenAt > current.firstSeenAt);
  const last = later.at(-1);
  return { what: lead.trim(), why, next: last ? { id: last.id, title: last.title, at: last.firstSeenAt } : null };
}
