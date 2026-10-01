import { prisma } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/stories/schema";
import { loadEditionView } from "./build";
import { CATEGORY_COLORS, joinHeadline } from "./compose";
import { editionKey, jstDateLabel, jstTime, SLOT_ORDER, SLOTS, type Slot } from "./slots";

/** URL の回の名前（/digest/2026-10-01/evening） */
export const slotSlug = (slot: Slot) => slot.toLowerCase();
export const slotFromSlug = (s: string): Slot | null => SLOT_ORDER.find((x) => slotSlug(x) === s) ?? null;
export const digestPath = (date: string, slot: Slot) => `/digest/${date}/${slotSlug(slot)}`;

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export type DigestItem = {
  topicId: number;
  label: string;
  color: string;
  headline: string;
  points: string[];
  why: string | null;
  publishers: string[];
  followup: boolean;
};

export type DigestPage = {
  date: string;
  slot: Slot;
  title: string;
  dateLabel: string;
  time: string;
  publishedAt: Date;
  items: DigestItem[];
};

/** 投稿済みの定時配信の回（人が承認して X に出した回だけ）。なければ null */
export async function getPublishedDigest(date: string, slot: Slot): Promise<DigestPage | null> {
  const edition = await prisma.edition.findUnique({
    where: { key: editionKey(date, slot) },
    include: { items: { orderBy: { position: "asc" }, select: { position: true, role: true, storyId: true, override: true } } },
  });
  if (!edition || edition.status !== "PUBLISHED") return null;
  const [view, stories] = await Promise.all([
    loadEditionView({ ...edition, slot }),
    prisma.story.findMany({ where: { id: { in: edition.items.map((i) => i.storyId) } }, select: { id: true, topicId: true } }),
  ]);
  const topicOf = new Map(stories.map((s) => [s.id, s.topicId]));
  const storyAt = new Map(edition.items.map((i) => [i.position, i.storyId]));
  const items = view.entries.flatMap((e): DigestItem[] => {
    const topicId = topicOf.get(storyAt.get(e.position) ?? "");
    if (!topicId) return [];
    const followup = e.role === "FOLLOWUP";
    return [
      {
        topicId,
        label: followup ? "続報" : e.category ? CATEGORY_LABELS[e.category] : "",
        color: e.category ? CATEGORY_COLORS[e.category] : "currentColor",
        headline: joinHeadline(e.headline),
        points: followup && e.delta ? [e.delta.now.text, ...e.points.map((p) => p.text)].slice(0, 3) : e.points.map((p) => p.text),
        why: e.why?.text ?? null,
        publishers: e.publishers,
        followup,
      },
    ];
  });
  if (items.length === 0) return null;
  return {
    date,
    slot,
    title: SLOTS[slot].title,
    dateLabel: jstDateLabel(date),
    time: jstTime(edition.scheduledAt),
    publishedAt: edition.publishedAt ?? edition.scheduledAt,
    items,
  };
}

export type DigestListItem = { date: string; slot: Slot; title: string; dateLabel: string; time: string; headlines: string[] };

/** 投稿済みの回の一覧（新しい順）。見出しは投稿文の「・」の行から取る */
export async function listPublishedDigests(take: number, skip = 0): Promise<DigestListItem[]> {
  const editions = await prisma.edition.findMany({
    where: { status: "PUBLISHED", slot: { not: "BREAKING" } },
    orderBy: { scheduledAt: "desc" },
    take,
    skip,
    select: { date: true, slot: true, scheduledAt: true, postText: true },
  });
  return editions.map((e) => {
    const slot = e.slot as Slot;
    return {
      date: e.date,
      slot,
      title: SLOTS[slot].title,
      dateLabel: jstDateLabel(e.date),
      time: jstTime(e.scheduledAt),
      headlines: e.postText.filter((l) => l.startsWith("・")).map((l) => l.slice(1).replace(/^続報：/, "続報：")),
    };
  });
}
