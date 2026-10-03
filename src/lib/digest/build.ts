import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import type { Assessment, Category, Sourced } from "@/lib/stories/schema";
import { independentOutletsOf } from "./outlets";
import { composePostText, type EditionEntry, type EditionView } from "./compose";
import { isTrustedPublisher } from "./trusted";
import { isAutoReviewable, selectForEdition, type Candidate } from "./select";
import { autoApproveEnabled, editionKey, isSingleSlot, jstAt, jstDate, ACTIVE_SLOTS, SLOTS, type Slot } from "./slots";

/** 前の配信回に載った出来事を、どこまでさかのぼって除外するか */
const EXCLUDE_LOOKBACK_HOURS = 30;

/**
 * 配信の候補。新しい出来事は「最初に報じられた時刻」、続報は登録した時刻で新しさを判断する。
 * 夜の「今日これだけ」は、今日すでに配信した出来事も候補に入れる（1日のまとめのため）
 */
/** 話題のジャンルから、配信の分野を当てる（分野が読み取れていない出来事に使う） */
const GENRE_CATEGORY: Record<string, Category> = {
  domestic: "SOCIETY",
  world: "WORLD",
  business: "ECONOMY",
  tech: "TECH",
  entertainment: "ENTERTAINMENT",
  sports: "SPORTS",
  game: "ENTERTAINMENT",
  anime: "ENTERTAINMENT",
  products: "LIFE",
  life: "LIFE",
};
export const categoryOfGenre = (slug: string | undefined): Category | null => (slug ? (GENRE_CATEGORY[slug] ?? null) : null);

export async function loadCandidates(since: Date, includePublished: boolean): Promise<Candidate[]> {
  const statuses = ["PENDING", "REVIEW_REQUIRED", "APPROVED", ...(includePublished ? ["PUBLISHED" as const] : [])] as const;
  const stories = await prisma.story.findMany({
    where: {
      status: { in: [...statuses] },
      OR: [
        { kind: "NEW", topic: { firstSeenAt: { gte: since } } },
        { kind: "FOLLOWUP", createdAt: { gte: since } },
      ],
    },
    select: {
      id: true,
      kind: true,
      status: true,
      category: true,
      eventThreadId: true,
      assessment: true,
      confidence: true,
      delta: true,
      topicId: true,
      riskFlags: true,
      statusNote: true,
      entities: true,
      sources: { select: { isPrimary: true, publisher: true } },
    },
  });
  const topicIds = [...new Set(stories.map((s) => s.topicId))];
  const [topics, clicks, outlets] = await Promise.all([
    prisma.topic.findMany({ where: { id: { in: topicIds } }, select: { id: true, publisherCount: true, genre: { select: { slug: true } } } }),
    prisma.article.groupBy({ by: ["topicId"], where: { topicId: { in: topicIds } }, _sum: { clicks: true, socialCount: true } }),
    prisma.article.findMany({
      where: { topicId: { in: topicIds }, source: { kind: "NEWS" } },
      distinct: ["topicId", "publisher", "title"],
      select: { topicId: true, publisher: true, title: true },
    }),
  ]);
  // 報じた媒体の数は、転載（ポータル・同じ見出しの記事）と同じ媒体の別名を除いた「独立した媒体」で数える（同じ記事の転載で話題が大きく見えないように）
  const outletRows = new Map<number, { publisher: string; title: string }[]>();
  for (const o of outlets) if (o.topicId) outletRows.set(o.topicId, [...(outletRows.get(o.topicId) ?? []), o]);
  const publishers = new Map(topics.map((t) => [t.id, Math.min(t.publisherCount, independentOutletsOf(outletRows.get(t.id) ?? []))]));
  const genreOf = new Map(topics.map((t) => [t.id, t.genre.slug]));
  const clickSum = new Map(clicks.map((c) => [c.topicId, c._sum.clicks ?? 0]));
  const socialSum = new Map(clicks.map((c) => [c.topicId, c._sum.socialCount ?? 0]));
  return stories.map((s) => ({
    id: s.id,
    kind: s.kind,
    status: s.status,
    // 分野が読み取れていない出来事は、話題のジャンルから補う（分野が空だと、同じ分野の本数の上限が効かないため）
    category: (s.category as Category | null) ?? categoryOfGenre(genreOf.get(s.topicId)),
    threadId: s.eventThreadId,
    topicId: s.topicId,
    assessment: s.assessment as Assessment | null,
    publisherCount: publishers.get(s.topicId) ?? 0,
    hasPrimary: s.sources.some((x) => x.isPrimary),
    confidence: s.confidence,
    clicks: clickSum.get(s.topicId) ?? 0,
    social: socialSum.get(s.topicId) ?? 0,
    autoOk: isAutoReviewable({
      status: s.status,
      statusNote: s.statusNote,
      riskFlags: s.riskFlags,
      confidence: s.confidence,
      publisherCount: publishers.get(s.topicId) ?? 0,
      assessment: s.assessment as Assessment | null,
      trusted: s.sources.some((x) => isTrustedPublisher(x.publisher)),
      hasPeople: ((s.entities as { people?: unknown[] } | null)?.people ?? []).length > 0,
    }),
    newFacts: ((s.delta as { newFacts?: unknown[] } | null)?.newFacts ?? []).length,
  }));
}

/**
 * 前の配信回（今日の前の回と前日の夜）に載った出来事と、ストーリーそのもの。
 * 出来事（系列）が付いていないストーリーもあるため、ストーリーの id でも除く。速報・注目のニュースで出したものも除く
 */
async function previousItems(slot: Slot, date: string, now: Date): Promise<{ threads: Set<string>; stories: Set<string>; topics: Set<number> }> {
  const cfg = SLOTS[slot];
  const editions = await prisma.edition.findMany({
    where: {
      scheduledAt: { gte: new Date(now.getTime() - EXCLUDE_LOOKBACK_HOURS * 3_600_000), lt: jstAt(date, cfg.publishAt) },
      status: { in: ["APPROVED", "PUBLISHED"] },
    },
    select: { date: true, items: { select: { storyId: true, story: { select: { eventThreadId: true, topicId: true } } } } },
  });
  const threads = new Set<string>();
  const stories = new Set<string>();
  const topics = new Set<number>();
  for (const e of editions) {
    if (cfg.allowRepeatToday && e.date === date) continue;
    for (const i of e.items) {
      stories.add(i.storyId);
      topics.add(i.story.topicId);
      if (i.story.eventThreadId) threads.add(i.story.eventThreadId);
    }
  }
  return { threads, stories, topics };
}

/**
 * 配信回の下書きを作る（同じ回が既にあれば何もしない）。投稿はしない。
 * 承認は人が行い、締め切りまでに承認されなければ投稿しない（仕様 11 章）。
 */
export async function buildEdition(slot: Slot, now = new Date()) {
  const cfg = SLOTS[slot];
  const date = jstDate(now);
  const key = editionKey(date, slot);
  const existing = await prisma.edition.findUnique({ where: { key }, select: { id: true, status: true } });
  if (existing) return { created: false as const, id: existing.id, status: existing.status };

  const prev = await previousItems(slot, date, now);
  // 前の回・速報で出したストーリーと、同じ話題の新しいストーリー（続報を除く）は候補にしない
  const candidates = (await loadCandidates(new Date(now.getTime() - cfg.windowHours * 3_600_000), cfg.allowRepeatToday)).filter(
    (c) => !prev.stories.has(c.id) && !(c.kind === "NEW" && c.topicId !== undefined && prev.topics.has(c.topicId)),
  );
  const selection = selectForEdition(candidates, cfg, prev.threads, { verifiedOnly: autoApproveEnabled() });
  const picked = [
    ...selection.main.map((s) => ({ ...s, role: "MAIN" as const })),
    ...selection.followups.map((s) => ({ ...s, role: "FOLLOWUP" as const })),
  ];
  const autoOkIds = new Set(candidates.filter((c) => c.autoOk).map((c) => c.id));
  const scheduledAt = jstAt(date, cfg.publishAt);
  const view = await loadEditionView({ slot, date, scheduledAt, items: picked.map((p, i) => ({ position: i + 1, role: p.role, storyId: p.id, override: null })) });

  try {
    const edition = await prisma.edition.create({
      data: {
        key,
        slot,
        date,
        // 載せる候補がなければ、この回は配信しない
        status: picked.length === 0 ? "SKIPPED" : "DRAFT",
        scheduledAt,
        deadlineAt: new Date(scheduledAt.getTime() - cfg.deadlineMinutes * 60_000),
        postText: composePostText(slot, date, view.entries),
        notes: { ...selection.notes, scores: picked.map((p) => ({ id: p.id, ...p.parts })) } as Prisma.InputJsonValue,
        // 要確認でも自動で載せてよいもの（autoOk）は、確認済みとして入れる（おまかせ投稿で止まらないように）
        items: { create: picked.map((p, i) => ({ position: i + 1, storyId: p.id, role: p.role, score: p.score, confirmed: autoOkIds.has(p.id) })) },
      },
      select: { id: true, status: true },
    });
    await logEvent("info", "digest.build", `${key}: ${picked.length}本`, edition.id, selection.notes);
    return { created: true as const, id: edition.id, status: edition.status };
  } catch (e) {
    // 同時に作られた場合（key の一意制約）は既存のものを返す
    const again = await prisma.edition.findUnique({ where: { key }, select: { id: true, status: true } });
    if (again) return { created: false as const, id: again.id, status: again.status };
    throw e;
  }
}

/** 人が編集した値（EditionItem.override）。Story の値より優先する */
export type ItemOverride = Partial<Pick<EditionEntry, "headline" | "shortTitle" | "keyword" | "points" | "why">>;

type ItemRef = { position: number; role: "MAIN" | "FOLLOWUP"; storyId: string; override: unknown };

/** 配信回の表示用データ（カード・投稿文の材料）を読む */
export async function loadEditionView(edition: { slot: Slot; date: string; scheduledAt: Date; items: ItemRef[] }): Promise<EditionView> {
  return { slot: edition.slot, date: edition.date, scheduledAt: edition.scheduledAt, entries: await loadEntries(edition.items) };
}

/** 掲載するストーリーを、人の編集を反映して読む */
export async function loadEntries(items: ItemRef[]): Promise<EditionEntry[]> {
  const ids = items.map((i) => i.storyId);
  const stories = await prisma.story.findMany({
    where: { id: { in: ids } },
    include: { sources: { orderBy: { position: "asc" } }, topic: { select: { firstSeenAt: true } } },
  });
  const prevIds = stories.map((s) => s.followupOf).filter((x): x is string => !!x);
  const prevs = await prisma.story.findMany({ where: { id: { in: prevIds } }, select: { id: true, publishedAt: true } });
  const prevAt = new Map(prevs.map((p) => [p.id, p.publishedAt]));
  const byId = new Map(stories.map((s) => [s.id, s]));
  return [...items]
    .sort((a, b) => a.position - b.position)
    .flatMap((item): EditionEntry[] => {
      const s = byId.get(item.storyId);
      if (!s) return [];
      const o = (item.override ?? {}) as ItemOverride;
      const delta = s.delta as { before: string; now: Sourced } | null;
      // 公式発表を先に、媒体名を出典として並べる
      const publishers = [...s.sources].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position).map((x) => x.publisher);
      return [
        {
          position: item.position,
          role: item.role,
          category: s.category as Category | null,
          headline: o.headline ?? s.headline,
          shortTitle: o.shortTitle ?? s.shortTitle ?? s.headline.join(""),
          keyword: o.keyword ?? s.keyword ?? "",
          points: o.points ?? ((s.points as Sourced[] | null) ?? []),
          why: o.why !== undefined ? o.why : ((s.why as Sourced | null) ?? null),
          delta: delta ? { before: delta.before, now: delta.now, previousAt: (s.followupOf && prevAt.get(s.followupOf)) || null } : null,
          publishers,
          firstSeenAt: s.topic.firstSeenAt,
        },
      ];
    });
}

/** 配信回を、表示用データとして読む */
export async function getEditionView(id: string) {
  const edition = await prisma.edition.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" }, select: { position: true, role: true, storyId: true, override: true } } },
  });
  if (!edition || isSingleSlot(edition.slot)) return null;
  return { edition, view: await loadEditionView({ ...edition, slot: edition.slot as Slot }) };
}

/** いま作るべき定時配信の回（下書きを作る時刻を過ぎ、投稿の時刻より前） */
export function currentSlot(now: Date): Slot | null {
  const date = jstDate(now);
  return ACTIVE_SLOTS.find((slot) => now >= jstAt(date, SLOTS[slot].buildAt) && now < jstAt(date, SLOTS[slot].publishAt)) ?? null;
}
