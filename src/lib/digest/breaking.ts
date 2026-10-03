import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { createActionToken } from "@/lib/admin/token";
import { HOT, hotReason, isHot } from "@/lib/stories/hot";
import type { Assessment } from "@/lib/stories/schema";
import { publishEdition } from "./publish";
import { editionKey, isSingleSlot, jstAt, jstDate, jstTime, SLOT_ORDER, SLOTS } from "./slots";

/**
 * 速報の自動投稿。誤報を出さないことを最優先に、条件を厳しく絞る。
 * - AI 解析で「速報（BREAKING）」と判定され、照合で問題がなかった（要確認でない）新しい出来事で、3媒体以上が報じている
 *   または、一斉に報じられた大きな出来事（src/lib/stories/hot.ts。結婚・引退・優勝など）で、2媒体以上が報じ、確度が特に高い
 * - 最初の報道から3時間以内
 * - 事件・死亡・選挙・政治の分野は出さない（誤りや配慮の問題が大きいため、定時の配信で扱う）
 * - 1日3本まで。23時〜6時は出さない（大地震・津波など災害だけは例外）
 * - 定時の配信の直前（20分以内）は出さない（その回に載る）
 */
export const BREAKING_RULES = {
  maxPerDay: 3,
  minPublishers: 3,
  /** 大きな出来事（速報の判定ではないもの）を自動で出す条件。人の確認なしで出すため、2媒体以上の一致と高い確度を求める */
  hot: { minPublishers: 2, minConfidence: 0.85 },
  /** 1媒体だけの大きな出来事は、信頼できる媒体が報じ、確度がとても高いときだけ（解析は無料の定期実行が行う） */
  single: { minConfidence: 0.9 },
  /** 人が「AI に確認させて投稿」を押した出来事は、媒体の数によらず、確度が高ければ出す（深夜でも出す） */
  requested: { minConfidence: 0.85 },
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
  /** AI が「速報（BREAKING）」と判定した出来事か（省略時は true） */
  breaking?: boolean;
  /** 一斉に報じられた大きな出来事か（src/lib/stories/hot.ts） */
  hot?: boolean;
  /** 信頼できる媒体（TRUSTED_PUBLISHERS）が報じているか */
  trusted?: boolean;
  /** 人が「AI に確認させて投稿」を押した出来事か */
  requested?: boolean;
};

/** 「AI に確認させて投稿」の記録（EventLog の scope）。ref はストーリーの ID */
export const REQUEST_SCOPE = "breaking.requested";

/** 1媒体だけでも自動の速報にしてよい、信頼できる媒体（通信社・全国紙・在京テレビ局・大手スポーツ紙・専門の大手媒体） */
const TRUSTED_PUBLISHERS =
  /NHK|時事|共同通信|朝日新聞|読売|毎日新聞|日本経済新聞|日経|産経|TBS|日テレ|テレ朝|FNN|フジテレビ|スポニチ|日刊スポーツ|スポーツ報知|サンケイスポーツ|デイリースポーツ|中日スポーツ|ゲキサカ|サッカーキング|Full-Count|oricon|オリコン|BBC/i;

export const isTrustedPublisher = (name: string) => TRUSTED_PUBLISHERS.test(name);

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

/** 自動の速報を今出せる状態か（今日の上限に達していない）。深夜かどうかも返す。API の解析を無駄にしないために使う */
export async function autoBreakingWindow(now = new Date()) {
  if (!breakingEnabled()) return { open: false, quiet: isQuietHour(now) };
  const posted = await prisma.edition.count({ where: { slot: "BREAKING", date: jstDate(now), status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } });
  return { open: posted < BREAKING_RULES.maxPerDay, quiet: isQuietHour(now) };
}

/** 見送りの理由（人が読む短い説明） */
export function skipReason(c: Pick<BreakingCandidate, "confidence" | "assessment" | "riskFlags">): string {
  if (c.assessment?.gossip) return "噂・私生活の話題と判断したため";
  if (c.assessment?.promotional) return "宣伝の性格が強いと判断したため";
  if (c.riskFlags.some((r) => (BREAKING_RULES.excludedRisks as readonly string[]).includes(r))) return "事件・訃報・選挙・政治の話題は自動では出さないため";
  if ((c.confidence ?? 0) < BREAKING_RULES.requested.minConfidence) return `資料から確かめきれなかったため（確からしさ ${Math.round((c.confidence ?? 0) * 100)}%）`;
  return "定時の配信の直前などの条件に当たったため";
}

/**
 * 「AI に確認させて投稿」を押した出来事の、見送りを知らせる（1つの出来事につき1回）。
 * 解析で照合に通らなかったもの（要確認・自動で除外）も知らせる
 */
async function notifyRequestedSkips(requested: Set<string | null>, skipped: BreakingCandidate[]) {
  const ids = [...requested].filter((x): x is string => !!x);
  if (ids.length === 0) return;
  const [done, rejected] = await Promise.all([
    prisma.eventLog.findMany({ where: { scope: "breaking.requested-result", ref: { in: ids } }, select: { ref: true } }),
    prisma.story.findMany({ where: { id: { in: ids }, status: { in: ["REVIEW_REQUIRED", "REJECTED_AUTO"] } }, select: { id: true, status: true, headline: true } }),
  ]);
  const notified = new Set(done.map((d) => d.ref));
  const items = [
    ...skipped.map((c) => ({ id: c.id, reason: skipReason(c) })),
    ...rejected.map((s) => ({ id: s.id, reason: s.status === "REVIEW_REQUIRED" ? "見出し・要点に資料と照合できない語があったため" : "資料が足りない・同じ出来事と言えないと判断したため" })),
  ].filter((x) => !notified.has(x.id));
  for (const x of items) {
    await logEvent("info", "breaking.requested-result", `AI の確認で見送り: ${x.reason}`, x.id);
    await notifyOwner({
      title: "AI の確認の結果、速報を見送りました",
      what: `「AI に確認させて投稿」を押した出来事を、AI が確認した結果、自動では投稿しませんでした。理由：${x.reason}。`,
      action: "出す場合は、管理画面の「速報を作る」で見出しを確かめて、手動で投稿してください。",
      url: "https://zenbu-navi.com/admin/breaking",
    });
  }
}

/** 条件に合う候補のうち、話題の最も大きいもの。なければ null */
export function pickBreaking(candidates: BreakingCandidate[], now: Date, postedToday: number): BreakingCandidate | null {
  if (postedToday >= BREAKING_RULES.maxPerDay || isJustBeforeSlot(now)) return null;
  const quiet = isQuietHour(now);
  const ok = candidates.filter((c) => {
    const asBreaking = c.breaking !== false && c.publisherCount >= BREAKING_RULES.minPublishers;
    // 大きな出来事は、2媒体以上が報じ、照合の確度が特に高いときだけ（人の確認なしで出すため）
    const asHot = Boolean(c.hot) && c.publisherCount >= BREAKING_RULES.hot.minPublishers && (c.confidence ?? 0) >= BREAKING_RULES.hot.minConfidence;
    // 1媒体だけの大きな出来事は、信頼できる媒体が報じ、確度がとても高いときだけ
    const asSingle = Boolean(c.hot) && Boolean(c.trusted) && (c.confidence ?? 0) >= BREAKING_RULES.single.minConfidence;
    // 人が求めた出来事は、媒体の数によらず、確度が高ければ出す
    const asRequested = Boolean(c.requested) && (c.confidence ?? 0) >= BREAKING_RULES.requested.minConfidence;
    if (!asBreaking && !asHot && !asSingle && !asRequested) return false;
    if (now.getTime() - c.firstSeenAt.getTime() > BREAKING_RULES.maxAgeHours * 3_600_000) return false;
    if (c.confidence !== null && c.confidence < BREAKING_RULES.minConfidence) return false;
    if (c.assessment?.gossip || c.assessment?.promotional) return false;
    if (c.riskFlags.some((r) => (BREAKING_RULES.excludedRisks as readonly string[]).includes(r))) return false;
    if (quiet && !asRequested && !c.riskFlags.some((r) => (BREAKING_RULES.nightAllowedRisks as readonly string[]).includes(r))) return false;
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

  const requested = new Set(
    (await prisma.eventLog.findMany({ where: { scope: REQUEST_SCOPE, at: { gte: new Date(now.getTime() - BREAKING_RULES.maxAgeHours * 3_600_000) } }, select: { ref: true } })).map(
      (l) => l.ref,
    ),
  );
  const stories = await prisma.story.findMany({
    where: {
      status: "PENDING",
      kind: "NEW",
      topic: { firstSeenAt: { gte: new Date(now.getTime() - BREAKING_RULES.maxAgeHours * 3_600_000) } },
      // 注目のニュースとして人が出した出来事は、速報で出し直さない
      items: { none: { edition: { slot: "PICKUP" } } },
    },
    select: {
      id: true,
      score: true,
      riskFlags: true,
      confidence: true,
      assessment: true,
      headline: true,
      cardType: true,
      topic: { select: { id: true, title: true, publisherCount: true, firstSeenAt: true, lastSeenAt: true, articles: { select: { publisher: true }, take: 30 } } },
    },
  });
  const candidates = stories.map(
    (s): BreakingCandidate => ({
      breaking: s.cardType === "BREAKING",
      hot: isHot(s.topic, now.getTime()),
      trusted: s.topic.articles.some((a) => isTrustedPublisher(a.publisher)),
      requested: requested.has(s.id),
      id: s.id,
      score: s.score,
      publisherCount: s.topic.publisherCount,
      firstSeenAt: s.topic.firstSeenAt,
      riskFlags: s.riskFlags,
      confidence: s.confidence,
      assessment: s.assessment as Assessment | null,
    }),
  );
  const pick = pickBreaking(candidates, now, postedToday);
  // 人が求めた出来事で、AI の確認の結果、出せなかったものを知らせる
  await notifyRequestedSkips(
    requested,
    candidates.filter((c) => c.requested && c.id !== pick?.id && !pickBreaking([c], now, 0)),
  ).catch((e) => logEvent("error", "breaking.requested", "見送りの通知に失敗", undefined, String(e)));
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
        items: { none: { edition: { slot: { in: ["BREAKING", "PICKUP"] } } } },
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

/**
 * 解析待ちの出来事に出す、見出しの下書き。話題の見出し（AI の見出しがあればそれ）の全文を1行で返す。
 * 要点のない出来事のカードは「見出しだけのカード」になり、見出しを大きく折り返して全部見せる（src/lib/digest/cards.tsx）
 */
export function draftHeadline(topic: { title: string; aiTitle: string | null }): string[] {
  const text = (topic.aiTitle || topic.title)
    .normalize("NFKC")
    // 媒体の飾り（【速報】など）と、末尾の媒体名の括弧を外す
    .replace(/【[^】]*】/g, "")
    .replace(/[（(][^）)]*[）)]\s*$/, "")
    .trim();
  return [text || topic.title];
}

// ---------------------------------------------------------------------------
// 大きな出来事の知らせ（解析を待たずに、運営者に速報の候補があることを知らせる）
// ---------------------------------------------------------------------------

export const HOT_RULES = {
  /** 24時間に知らせる上限 */
  maxPerDay: 10,
} as const;

type HotTopic = { id: number; title?: string | null; publisherCount: number; firstSeenAt: Date; lastSeenAt?: Date | null };

/** 知らせる出来事を選ぶ（まだ知らせていない・一斉に報じられている。判定は src/lib/stories/hot.ts） */
export function pickHotTopics<T extends HotTopic>(topics: T[], notified: Set<number>, now: Date, sentToday: number): T[] {
  const room = Math.max(0, HOT_RULES.maxPerDay - sentToday);
  return topics
    .filter((t) => !notified.has(t.id) && hotReason(t, now.getTime()) !== null)
    .sort((a, b) => b.publisherCount - a.publisherCount)
    .slice(0, room);
}

/** メールから開く、速報の候補1件の操作画面（鍵が作れなければ管理画面） */
function quickUrl(storyId: string) {
  const token = createActionToken(storyId);
  return token ? `https://zenbu-navi.com/admin/quick/${token}` : "https://zenbu-navi.com/admin/breaking";
}

/** 速報の確認のたびに呼ぶ。多くの媒体が一斉に報じた出来事があれば、運営者に知らせる（深夜も知らせる） */
export async function notifyHotTopics(now = new Date()) {
  const since = new Date(now.getTime() - HOT.withinHours * 3_600_000);
  const [topics, logs] = await Promise.all([
    prisma.topic.findMany({
      where: { firstSeenAt: { gte: since }, mergedIntoId: null, aiNotNews: false, stories: { some: { kind: "NEW" } } },
      orderBy: { firstSeenAt: "desc" },
      take: 500,
      select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true, lastSeenAt: true, stories: { where: { kind: "NEW" }, select: { id: true }, take: 1 } },
    }),
    prisma.eventLog.findMany({ where: { scope: "breaking.hot", at: { gte: new Date(now.getTime() - 24 * 3_600_000) } }, select: { ref: true } }),
  ]);
  const picked = pickHotTopics(topics, new Set(logs.map((l) => Number(l.ref))), now, logs.length);
  for (const t of picked) {
    const title = t.aiTitle || t.title;
    await logEvent("info", "breaking.hot", `速報の候補: ${title}`, String(t.id), { publishers: t.publisherCount });
    // 速報としてすでに出していれば知らせない
    const posted = await prisma.editionItem.count({ where: { storyId: t.stories[0].id, edition: { slot: { in: ["BREAKING", "PICKUP"] } } } });
    if (posted) continue;
    const minutes = Math.max(1, Math.round((now.getTime() - t.firstSeenAt.getTime()) / 60_000));
    await notifyOwner({
      title: `速報の候補：${title}`.slice(0, 60),
      what: `「${title}」（${hotReason(t, now.getTime())}）。最初の報道から${minutes}分で、${t.publisherCount}媒体が報じています。`,
      action:
        "下のボタンから、ログインせずに操作できます（6時間有効）。「AI に確認させて投稿」なら AI が数分で確かめて投稿し、自分で見出しを直してすぐ投稿することもできます。出さない場合は対応は不要です。",
      // ログインせずに、この出来事の速報だけを操作できるリンク（署名付き・6時間有効）
      url: quickUrl(t.stories[0].id),
      button: "速報の操作画面を開く",
    });
  }
  return picked.length;
}

/**
 * カードの形。headline は見出しだけを大きく見せるカード（要点を出さない）、points は見出し＋要点のカード。
 * 配信回の項目の上書き（override.layout）に残し、投稿のときのカードに使う
 */
export type CardLayout = "headline" | "points";
const itemOverride = (edited: string[] | null, layout: CardLayout) =>
  edited || layout === "headline" ? { override: { ...(edited ? { headline: edited } : {}), ...(layout === "headline" ? { layout } : {}) } } : {};

/** 選んだ出来事で速報の回を作る（承認済み）。同じ出来事の速報が今日すでにあれば null */
export async function createManualBreaking(storyId: string, now = new Date(), headline?: string[], layout: CardLayout = "points") {
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
        items: { create: [{ position: 1, storyId: story.id, role: "MAIN", ...itemOverride(edited, layout) }] },
      },
      select: { id: true },
    })
    .catch(() => null);
}

/** 注目のニュースの投稿文（速報とは言わない） */
export function pickupPostText(headline: string[]): string[] {
  return ["📌 注目のニュース", "", headline.join("")];
}

/** 回の種類に合わせた投稿文 */
const postTextOf = (slot: string, headline: string[], at: Date) => (slot === "PICKUP" ? pickupPostText(headline) : breakingPostText(headline, at));

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
  if (!e || !isSingleSlot(e.slot) || !e.items[0]) return;
  if (e.publications.some((p) => p.parts.length > 0)) return;
  await prisma.edition.update({
    where: { id: editionId },
    data: { scheduledAt: now, deadlineAt: now, postText: postTextOf(e.slot, headlineOf(e.items[0]), now) },
  });
}

// ---------------------------------------------------------------------------
// 注目のニュース（速報の表示なし。自動では出さず、人が選んで手動で投稿する）
// 速報ほど急ぎではないが、多くの媒体が報じた出来事を、速報と同じ形の1枚のカードで出す
// ---------------------------------------------------------------------------

/** 管理画面の候補に出す範囲（最初の報道からの時間） */
export const PICKUP_HOURS = 24;

/** 注目のニュースの候補：直近24時間に最初に報じられ、速報・注目のニュースとしてまだ出していない出来事（媒体の多い順） */
export async function listPickupCandidates(now = new Date(), take = 20) {
  const since = new Date(now.getTime() - PICKUP_HOURS * 3_600_000);
  const [stories, postedToday] = await Promise.all([
    prisma.story.findMany({
      where: {
        status: { in: ["QUEUED", "PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"] },
        kind: "NEW",
        topic: { firstSeenAt: { gte: since }, mergedIntoId: null },
        items: { none: { edition: { slot: { in: ["BREAKING", "PICKUP"] } } } },
      },
      orderBy: [{ topic: { publisherCount: "desc" } }, { score: "desc" }],
      take,
      select: {
        id: true,
        headline: true,
        status: true,
        riskFlags: true,
        confidence: true,
        topic: { select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true } },
      },
    }),
    prisma.edition.count({ where: { slot: "PICKUP", date: jstDate(now), status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } }),
  ]);
  return { stories, postedToday };
}

/** 選んだ出来事で注目のニュースの回を作る（承認済み）。同じ出来事の回が今日すでにあれば null */
export async function createPickup(storyId: string, now = new Date(), headline?: string[], layout: CardLayout = "points") {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, headline: true } });
  if (!story || (!story.headline.length && !headline?.length)) return null;
  const date = jstDate(now);
  const edited = headline?.length && headline.join("") !== story.headline.join("") ? headline : null;
  return prisma.edition
    .create({
      data: {
        key: editionKey(date, "PICKUP", story.id),
        slot: "PICKUP",
        date,
        status: "APPROVED",
        scheduledAt: now,
        deadlineAt: now,
        approvedAt: now,
        approvedBy: "admin",
        postText: pickupPostText(edited ?? story.headline),
        items: { create: [{ position: 1, storyId: story.id, role: "MAIN", ...itemOverride(edited, layout) }] },
      },
      select: { id: true },
    })
    .catch(() => null);
}
