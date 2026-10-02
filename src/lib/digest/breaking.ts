import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import type { Assessment } from "@/lib/stories/schema";
import { publishEdition } from "./publish";
import { editionKey, jstAt, jstDate, jstTime, SLOT_ORDER, SLOTS } from "./slots";

/**
 * 速報の自動投稿。誤報を出さないことを最優先に、条件を厳しく絞る。
 * - AI 解析で「速報（BREAKING）」と判定され、照合で問題がなかった（要確認でない）新しい出来事
 * - 3媒体以上が報じている、最初の報道から3時間以内
 * - 事件・死亡・選挙・政治の分野は出さない（誤りや配慮の問題が大きいため、定時の配信で扱う）
 * - 1日2本まで。23時〜6時は出さない（大地震・津波など災害だけは例外）
 * - 定時の配信の直前（20分以内）は出さない（その回に載る）
 */
export const BREAKING_RULES = {
  maxPerDay: 2,
  minPublishers: 3,
  maxAgeHours: 3,
  minConfidence: 0.8,
  quietFrom: 23,
  quietUntil: 6,
  beforeSlotMinutes: 20,
  excludedRisks: ["CRIME", "DEATH", "ELECTION", "POLITICS"],
  /** 深夜でも出す分野 */
  nightAllowedRisks: ["DISASTER"],
} as const;

export type BreakingCandidate = {
  id: string;
  score: number;
  publisherCount: number;
  firstSeenAt: Date;
  riskFlags: string[];
  confidence: number | null;
  assessment: Assessment | null;
};

/** 日本時間の時（0〜23） */
const jstHour = (at: Date) => Number(jstTime(at).split(":")[0]);

export function isQuietHour(now: Date): boolean {
  const h = jstHour(now);
  return h >= BREAKING_RULES.quietFrom || h < BREAKING_RULES.quietUntil;
}

/** 定時の配信の直前か（その回に載るので速報は出さない） */
export function isJustBeforeSlot(now: Date): boolean {
  const date = jstDate(now);
  return SLOT_ORDER.some((slot) => {
    const diff = jstAt(date, SLOTS[slot].publishAt).getTime() - now.getTime();
    return diff >= 0 && diff <= BREAKING_RULES.beforeSlotMinutes * 60_000;
  });
}

/** 条件に合う候補のうち、話題の最も大きいもの。なければ null */
export function pickBreaking(candidates: BreakingCandidate[], now: Date, postedToday: number): BreakingCandidate | null {
  if (postedToday >= BREAKING_RULES.maxPerDay || isJustBeforeSlot(now)) return null;
  const quiet = isQuietHour(now);
  const ok = candidates.filter((c) => {
    if (c.publisherCount < BREAKING_RULES.minPublishers) return false;
    if (now.getTime() - c.firstSeenAt.getTime() > BREAKING_RULES.maxAgeHours * 3_600_000) return false;
    if (c.confidence !== null && c.confidence < BREAKING_RULES.minConfidence) return false;
    if (c.assessment?.gossip || c.assessment?.promotional) return false;
    if (c.riskFlags.some((r) => (BREAKING_RULES.excludedRisks as readonly string[]).includes(r))) return false;
    if (quiet && !c.riskFlags.some((r) => (BREAKING_RULES.nightAllowedRisks as readonly string[]).includes(r))) return false;
    return true;
  });
  return ok.sort((a, b) => b.score - a.score)[0] ?? null;
}

/** 速報の投稿文（本投稿）。時刻を明記する */
export function breakingPostText(headline: string[], at: Date): string[] {
  return [`⚡ 速報（${jstTime(at)}時点）`, "", headline.join("")];
}

/** 人が直した見出し（配信回の項目の上書き）があれば、それを使う */
function headlineOf(item: { override: unknown; story: { headline: string[] } }): string[] {
  const o = item.override as { headline?: unknown } | null;
  return Array.isArray(o?.headline) && o.headline.length && o.headline.every((l) => typeof l === "string") ? (o.headline as string[]) : item.story.headline;
}

export function breakingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.BREAKING_ENABLED !== "false" && env.AUTO_PUBLISH !== "false";
}

/** 定期的に呼ぶ。条件に合う速報があれば1本だけ投稿する */
export async function runBreakingCheck(now = new Date()) {
  // 自動の速報を止めていても、大きな出来事の知らせは出す（人が出すかどうかを決める）
  await notifyHotTopics(now).catch((e) => logEvent("error", "breaking.hot", "速報の候補の通知に失敗", undefined, String(e)));
  if (!breakingEnabled()) return { result: "disabled" as const };
  const date = jstDate(now);
  const postedToday = await prisma.edition.count({ where: { slot: "BREAKING", date, status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } });
  if (postedToday >= BREAKING_RULES.maxPerDay) return { result: "limit" as const };

  const stories = await prisma.story.findMany({
    where: {
      cardType: "BREAKING",
      status: "PENDING",
      kind: "NEW",
      topic: { firstSeenAt: { gte: new Date(now.getTime() - BREAKING_RULES.maxAgeHours * 3_600_000) } },
    },
    select: {
      id: true,
      score: true,
      riskFlags: true,
      confidence: true,
      assessment: true,
      headline: true,
      topic: { select: { id: true, publisherCount: true, firstSeenAt: true } },
    },
  });
  const pick = pickBreaking(
    stories.map((s) => ({
      id: s.id,
      score: s.score,
      publisherCount: s.topic.publisherCount,
      firstSeenAt: s.topic.firstSeenAt,
      riskFlags: s.riskFlags,
      confidence: s.confidence,
      assessment: s.assessment as Assessment | null,
    })),
    now,
    postedToday,
  );
  if (!pick) return { result: "none" as const, candidates: stories.length };
  const story = stories.find((s) => s.id === pick.id)!;

  const edition = await prisma.edition
    .create({
      data: {
        key: editionKey(date, "BREAKING", story.id),
        slot: "BREAKING",
        date,
        status: "APPROVED",
        scheduledAt: now,
        deadlineAt: now,
        approvedAt: now,
        approvedBy: "auto-breaking",
        postText: breakingPostText(story.headline, now),
        items: { create: [{ position: 1, storyId: story.id, role: "MAIN" }] },
      },
      select: { id: true, key: true },
    })
    // 同じ出来事の速報が既にある（同時実行など）
    .catch(() => null);
  if (!edition) return { result: "duplicate" as const };

  try {
    await publishEdition(edition.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await notifyOwner({
      title: "速報を投稿できませんでした",
      what: `速報「${story.headline.join("")}」の投稿に失敗しました。`,
      action: "急ぎでは不要です。管理画面の「ログ」で原因を確認できます。",
      detail: message,
    });
    return { result: "failed" as const, editionId: edition.id, error: message };
  }
  await logEvent("info", "breaking", `速報を投稿: ${story.headline.join("")}`, edition.id, { storyId: story.id, topicId: story.topic.id });
  await notifyOwner({
    title: "速報を投稿しました",
    what: `「${story.headline.join("")}」を速報として X に投稿しました（${story.topic.publisherCount}媒体が報道）。`,
    action: "対応は不要です。内容に誤りがあれば、X で投稿を削除してください。",
  });
  return { result: "published" as const, editionId: edition.id };
}

// ---------------------------------------------------------------------------
// 管理画面から出す速報（人が選んで出す。自動の速報の条件は使わず、注意の印を見せて人が判断する）
// ---------------------------------------------------------------------------

/** 管理画面の候補に出す範囲（最初の報道からの時間） */
export const MANUAL_BREAKING_HOURS = 6;

/** 速報の候補：直近に最初に報じられた、まだ配信していない出来事（媒体の多い順。解析待ちも含む） */
export async function listBreakingCandidates(now = new Date(), take = 20) {
  const since = new Date(now.getTime() - MANUAL_BREAKING_HOURS * 3_600_000);
  const [stories, postedToday] = await Promise.all([
    prisma.story.findMany({
      where: {
        // 解析待ち（QUEUED）も出す。大きな出来事は解析を待たずに、人が見出しを書いて出せるようにする
        status: { in: ["QUEUED", "PENDING", "REVIEW_REQUIRED", "APPROVED"] },
        kind: "NEW",
        topic: { firstSeenAt: { gte: since } },
        items: { none: { edition: { slot: "BREAKING" } } },
      },
      // いま報じている媒体の多い順（話題度の数値より、一斉に報じられていることを重く見る）
      orderBy: [{ topic: { publisherCount: "desc" } }, { score: "desc" }],
      take,
      select: {
        id: true,
        headline: true,
        status: true,
        cardType: true,
        riskFlags: true,
        confidence: true,
        topic: { select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true } },
      },
    }),
    prisma.edition.count({ where: { slot: "BREAKING", date: jstDate(now), status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } }),
  ]);
  return { stories, postedToday };
}

/** 解析待ちの出来事に出す、見出しの下書き（話題の見出し。投稿の前に人が12字×2行に直す） */
export function draftHeadline(topic: { title: string; aiTitle: string | null }): string[] {
  return [topic.aiTitle || topic.title];
}

// ---------------------------------------------------------------------------
// 大きな出来事の知らせ（解析を待たずに、運営者に速報の候補があることを知らせる）
// ---------------------------------------------------------------------------

export const HOT_RULES = {
  /** この媒体数以上が報じたら知らせる */
  minPublishers: 5,
  /** 最初の報道から、この時間以内の出来事だけ */
  maxAgeHours: 3,
  /** 24時間に知らせる上限 */
  maxPerDay: 6,
} as const;

type HotTopic = { id: number; publisherCount: number; firstSeenAt: Date };

/** 知らせる出来事を選ぶ（まだ知らせていない・新しい・多くの媒体が報じている） */
export function pickHotTopics<T extends HotTopic>(topics: T[], notified: Set<number>, now: Date, sentToday: number): T[] {
  const room = Math.max(0, HOT_RULES.maxPerDay - sentToday);
  return topics
    .filter(
      (t) =>
        !notified.has(t.id) && t.publisherCount >= HOT_RULES.minPublishers && now.getTime() - t.firstSeenAt.getTime() <= HOT_RULES.maxAgeHours * 3_600_000,
    )
    .sort((a, b) => b.publisherCount - a.publisherCount)
    .slice(0, room);
}

/** 速報の確認のたびに呼ぶ。多くの媒体が一斉に報じた出来事があれば、運営者に知らせる（深夜も知らせる） */
export async function notifyHotTopics(now = new Date()) {
  const since = new Date(now.getTime() - HOT_RULES.maxAgeHours * 3_600_000);
  const [topics, logs] = await Promise.all([
    prisma.topic.findMany({
      where: { firstSeenAt: { gte: since }, publisherCount: { gte: HOT_RULES.minPublishers }, mergedIntoId: null, aiNotNews: false, stories: { some: { kind: "NEW" } } },
      select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true, stories: { where: { kind: "NEW" }, select: { id: true }, take: 1 } },
    }),
    prisma.eventLog.findMany({ where: { scope: "breaking.hot", at: { gte: new Date(now.getTime() - 24 * 3_600_000) } }, select: { ref: true } }),
  ]);
  const picked = pickHotTopics(topics, new Set(logs.map((l) => Number(l.ref))), now, logs.length);
  for (const t of picked) {
    const title = t.aiTitle || t.title;
    await logEvent("info", "breaking.hot", `速報の候補: ${title}`, String(t.id), { publishers: t.publisherCount });
    // 速報としてすでに出していれば知らせない
    const posted = await prisma.editionItem.count({ where: { storyId: t.stories[0].id, edition: { slot: "BREAKING" } } });
    if (posted) continue;
    const minutes = Math.max(1, Math.round((now.getTime() - t.firstSeenAt.getTime()) / 60_000));
    await notifyOwner({
      title: `速報の候補：${title}`.slice(0, 60),
      what: `「${title}」を、最初の報道から${minutes}分で${t.publisherCount}媒体が報じています。`,
      action: "速報として出す場合は、管理画面の「速報を作る」で見出しを確かめて投稿してください。出さない場合は対応は不要です。",
    });
  }
  return picked.length;
}

/** 選んだ出来事で速報の回を作る（承認済み）。同じ出来事の速報が今日すでにあれば null */
export async function createManualBreaking(storyId: string, now = new Date(), headline?: string[]) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, headline: true } });
  // 解析待ちの出来事は見出しがまだないため、人が書いた見出しが必要
  if (!story || (!story.headline.length && !headline?.length)) return null;
  const date = jstDate(now);
  // 人が見出しを直したときは、配信回の項目に上書きとして残す（カードの見出しにも使われる）
  const edited = headline?.length && headline.join("") !== story.headline.join("") ? headline : null;
  return prisma.edition
    .create({
      data: {
        key: editionKey(date, "BREAKING", story.id),
        slot: "BREAKING",
        date,
        status: "APPROVED",
        scheduledAt: now,
        deadlineAt: now,
        approvedAt: now,
        approvedBy: "admin",
        postText: breakingPostText(edited ?? story.headline, now),
        items: { create: [{ position: 1, storyId: story.id, role: "MAIN", ...(edited ? { override: { headline: edited } } : {}) }] },
      },
      select: { id: true },
    })
    .catch(() => null);
}

/**
 * 速報の時刻を、実際に投稿する時刻に合わせる（作ってから投稿するまでに時間が空いても、
 * 投稿文の「⚡ 速報（HH:MM時点）」とカードの時刻が投稿の時刻とずれないように）。
 * まだ1件も送っていない回だけを直す（途中まで送った回の続きでは変えない）。
 */
export async function stampBreakingTime(editionId: string, now = new Date()) {
  const e = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      slot: true,
      items: { take: 1, select: { override: true, story: { select: { headline: true } } } },
      publications: { select: { parts: { where: { externalId: { not: null } }, select: { position: true } } } },
    },
  });
  if (!e || e.slot !== "BREAKING" || !e.items[0]) return;
  if (e.publications.some((p) => p.parts.length > 0)) return;
  await prisma.edition.update({
    where: { id: editionId },
    data: { scheduledAt: now, deadlineAt: now, postText: breakingPostText(headlineOf(e.items[0]), now) },
  });
}
