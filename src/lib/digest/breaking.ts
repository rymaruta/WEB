import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { createActionToken } from "@/lib/admin/token";
import { famousSubject } from "@/lib/fame";
import { bigWord, HOT, hotReason, isDisasterTitle, isHot, isSensitiveTitle } from "@/lib/stories/hot";
import { subjectNames } from "@/lib/topics/conflict";
import type { Assessment } from "@/lib/stories/schema";
import { publishEdition } from "./publish";
import { isTrustedPublisher } from "./trusted";

export { isTrustedPublisher };
import { editionKey, isSingleSlot, jstAt, jstDate, jstTime, ACTIVE_SLOTS, SLOTS } from "./slots";

/**
 * 速報の自動投稿。誤報を出さないことを最優先に、条件を厳しく絞る。
 * - AI 解析で「速報（BREAKING）」と判定され、照合で問題がなかった（要確認でない）新しい出来事で、3媒体以上が報じている
 *   または、一斉に報じられた大きな出来事（src/lib/stories/hot.ts。結婚・引退・優勝など）で、2媒体以上が報じ、確度が特に高い
 * - 最初の報道から3時間以内
 * - 事件・死亡・選挙・政治の分野は、信頼できる媒体を含む3社以上の報道・高い確度・個人名のない見出しのときだけ出す（BREAKING_RULES.sensitive）
 * - 1日3本まで。23時〜6時は出さない（大地震・津波など災害だけは例外）
 * - 定時の配信の直前（20分以内）は出さない（その回に載る）
 */
export const BREAKING_RULES = {
  maxPerDay: 3,
  /** スポーツの速報は1日この本数まで（スポーツに偏らないように） */
  maxSportsPerDay: 1,
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
  /** 慎重に扱う分野（事件・訃報・選挙・政治）。下の sensitive の条件をすべて満たすときだけ自動で出す */
  excludedRisks: ["CRIME", "DEATH", "ELECTION", "POLITICS"],
  /**
   * 慎重に扱う分野を自動で出す条件（運営者の方針。2026-10-07。以前は一切出さなかった）。
   * 独立した媒体3社以上が報じ、通信社・NHK・全国紙などの信頼できる媒体を含み、確度が特に高い。
   * 見出しに個人名（容疑者・被害者・故人など）を入れない。深夜は出さない
   */
  sensitive: { minPublishers: 3, minConfidence: 0.85 },
  /** 深夜でも出す分野 */
  nightAllowedRisks: ["DISASTER"],
} as const;

/** 試合に負けたことを表す言葉（速報にしない） */
const SPORTS_LOSS = /敗れ|敗退|負け|黒星|完敗|惜敗|連敗|逆転負け|敗戦|初戦敗退|予選落ち|落選/;

/** 世間がほとんど知らないスポーツ（年代別の代表・学生・アマチュア・公営競技） */
const SPORTS_MINOR = /U-?\d{2}|U\d{2}|ユース|ジュニア|高校|高校生|インターハイ|甲子園(?!球場)|大学|学生|アマチュア|社会人|実業団|ボートレース|競艇|競輪|オートレース|地方競馬|ボート・/;
/** 移籍・入団・メジャー挑戦（有名なクラブ・選手なら関心が高い。例: バルサ・レアルへの移籍、メジャーリーグへの移籍） */
const SPORTS_MOVE = /移籍|入団|加入|完全移籍|メジャー挑戦|ポスティング|メジャー契約|MLB/;
/** 日本代表（年代別は SPORTS_MINOR で先に除く） */
const NATIONAL_TEAM = /日本代表|侍ジャパン|なでしこジャパン|森保ジャパン|サムライブルー|SAMURAI BLUE/;

/** 知名度を問わず速報にしてよい、報じた媒体の数（これだけ多くの媒体が報じれば、世間の関心は明らか） */
export const WIDE_ENOUGH = 8;

/**
 * 世間が関心を持つ出来事か（速報の条件。運営者の方針：誰もが知っている人・会社・作品の出来事が速報。2026-10-04）。
 * - 災害（地震・津波・噴火など）
 * - 独立した媒体 WIDE_ENOUGH 社以上が報じた
 * - 見出しに、よく知られた人・会社・作品が出てくる（src/lib/fame.ts。例: 久保建英、福原遥、メッシ、エヌビディア）
 * 知名度を調べられなかった（ウィキペディアにつながらない）ときは、5媒体以上なら関心ありとみなす
 */
export async function publicInterest(t: { title: string; publisherCount: number; sports?: boolean }): Promise<string | null> {
  if (isDisasterTitle(t.title)) return "災害";
  if (t.sports) {
    // スポーツは、優勝・金メダル・新記録・引退・結婚などの節目だけ（負けた・敗退した試合は速報にしない）。
    // 年代別・学生・アマチュア・公営競技は、勝っても世間はほとんど知らないので速報にしない。
    // そのうえで、日本代表（年代別を除く）か、よく知られた選手・チームのときだけ（運営者の方針。2026-10-04）
    if (!(bigWord(t.title) || SPORTS_MOVE.test(t.title)) || SPORTS_LOSS.test(t.title) || SPORTS_MINOR.test(t.title.normalize("NFKC"))) return null;
    if (NATIONAL_TEAM.test(t.title.normalize("NFKC"))) return "日本代表";
    try {
      const f = await famousSubject(t.title);
      return f ? `「${f.title}」` : null;
    } catch {
      return null;
    }
  }
  if (t.publisherCount >= WIDE_ENOUGH) return `${t.publisherCount}媒体が報道`;
  // 事件・政治・訃報などの社会の出来事は、主役の知名度ではなく報道の広がりで見る（投稿の可否は sensitiveAllowed で厳しく確かめる）
  if (isSensitiveTitle(t.title) && t.publisherCount >= BREAKING_RULES.sensitive.minPublishers) return `社会の出来事・${t.publisherCount}媒体が報道`;
  try {
    const f = await famousSubject(t.title);
    return f ? `「${f.title}」` : null;
  } catch {
    return t.publisherCount >= HOT.wide.minPublishers ? `${t.publisherCount}媒体が報道` : null;
  }
}

/** 要確認の理由が「慎重に扱う分野」だけか（照合・確からしさ・食い違いの問題がない） */
export function onlySensitiveReview(statusNote: string | null): boolean {
  const reasons = (statusNote ?? "").split("\n").filter(Boolean);
  return reasons.length > 0 && reasons.every((r) => r.startsWith("慎重に扱う分野"));
}

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
  /** 見出しに個人名があるか（慎重に扱う分野では、個人名のある見出しは自動で出さない） */
  namesInHeadline?: boolean;
};

/** 慎重に扱う分野（事件・訃報・選挙・政治）の出来事か */
export const isSensitive = (c: Pick<BreakingCandidate, "riskFlags">) => c.riskFlags.some((r) => (BREAKING_RULES.excludedRisks as readonly string[]).includes(r));

/** 慎重に扱う分野の出来事を、自動で出してよいか（BREAKING_RULES.sensitive） */
export function sensitiveAllowed(c: Pick<BreakingCandidate, "publisherCount" | "trusted" | "confidence" | "namesInHeadline">): boolean {
  return (
    c.publisherCount >= BREAKING_RULES.sensitive.minPublishers &&
    c.trusted === true &&
    (c.confidence ?? 0) >= BREAKING_RULES.sensitive.minConfidence &&
    c.namesInHeadline !== true
  );
}

/** 「AI に確認させて投稿」の記録（EventLog の scope）。ref はストーリーの ID */
export const REQUEST_SCOPE = "breaking.requested";


/** 日本時間の時（0〜23） */
const jstHour = (at: Date) => Number(jstTime(at).split(":")[0]);

export function isQuietHour(now: Date): boolean {
  const h = jstHour(now);
  return h >= BREAKING_RULES.quietFrom || h < BREAKING_RULES.quietUntil;
}

/** 定時の配信の直前か（その回に載るので速報は出さない） */
export function isJustBeforeSlot(now: Date): boolean {
  const date = jstDate(now);
  return ACTIVE_SLOTS.some((slot) => {
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
export function skipReason(c: Pick<BreakingCandidate, "confidence" | "assessment" | "riskFlags" | "publisherCount" | "trusted" | "namesInHeadline">): string {
  if (c.assessment?.gossip) return "噂・私生活の話題と判断したため";
  if (c.assessment?.promotional) return "宣伝の性格が強いと判断したため";
  if (isSensitive(c) && !sensitiveAllowed(c)) return "事件・訃報・選挙・政治の話題で、信頼できる媒体を含む3社以上の報道・高い確度・個人名のない見出しの条件を満たさなかったため";
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
    // 事件・訃報・選挙・政治は、条件付きで出す（深夜は出さない）
    if (isSensitive(c) && (!sensitiveAllowed(c) || quiet)) return false;
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
  // 大きな地震・津波警報・噴火速報は、気象庁の発表から直接出す（AI の解析を待たない。ふだんの上限とは別。src/lib/digest/jma-breaking.ts）
  const { runJmaBreaking } = await import("./jma-breaking");
  const jma = await runJmaBreaking(now).catch(async (e) => {
    await logEvent("error", "breaking.jma", "気象庁の発表からの速報に失敗", undefined, String(e));
    return { result: "error" as const };
  });
  if (jma.result === "published") return { result: "published-jma" as const, editionId: jma.editionId };
  const date = jstDate(now);
  const postedToday = await prisma.edition.count({ where: { slot: "BREAKING", date, status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } });
  if (postedToday >= BREAKING_RULES.maxPerDay) return { result: "limit" as const };

  const requestLogs = await prisma.eventLog.findMany({
    where: { scope: REQUEST_SCOPE, at: { gte: new Date(now.getTime() - BREAKING_RULES.maxAgeHours * 3_600_000) } },
    select: { ref: true, data: true },
  });
  const requested = new Set(requestLogs.map((l) => l.ref));
  // 自動で AI に確認を頼んだもの（人が頼んだものではないので、見送りをメールで知らせない）
  const autoRequested = new Set(requestLogs.filter((l) => (l.data as { auto?: boolean } | null)?.auto).map((l) => l.ref));
  // スポーツに偏らないよう、スポーツの速報は1日 BREAKING_RULES.maxSportsPerDay 本まで
  const sportsToday = await prisma.edition.count({
    where: { slot: "BREAKING", date, status: { in: ["APPROVED", "PUBLISHED", "FAILED"] }, items: { some: { story: { category: "SPORTS" } } } },
  });
  const stories = await prisma.story.findMany({
    where: {
      // 要確認（REVIEW_REQUIRED）は、理由が「慎重に扱う分野」だけのもの（事件・政治など）に限って下で残す
      status: { in: ["PENDING", "REVIEW_REQUIRED"] },
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
      category: true,
      status: true,
      statusNote: true,
      topic: { select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true, lastSeenAt: true, articles: { select: { publisher: true }, take: 30 } } },
    },
  }).then((rows) => rows.filter((r) => r.status === "PENDING" || onlySensitiveReview(r.statusNote)));
  // 世間の関心がある出来事だけ（人・自動で AI に確認を頼んだものは、頼む前に確かめ済み）。スポーツは1日の上限まで
  const interesting = new Set<string>();
  for (const st of stories) {
    if (st.category === "SPORTS" && sportsToday >= BREAKING_RULES.maxSportsPerDay) continue;
    if (requested.has(st.id) || (await publicInterest({ title: st.topic.aiTitle || st.topic.title, publisherCount: st.topic.publisherCount, sports: st.category === "SPORTS" }))) interesting.add(st.id);
  }
  const candidates = stories.filter((st) => interesting.has(st.id)).map(
    (s): BreakingCandidate => ({
      breaking: s.cardType === "BREAKING",
      hot: isHot(s.topic, now.getTime()),
      trusted: s.topic.articles.some((a) => isTrustedPublisher(a.publisher)),
      requested: requested.has(s.id),
      namesInHeadline: subjectNames(s.headline.join("")).length > 0,
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
    new Set([...requested].filter((r) => !autoRequested.has(r))),
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
      take: take * 3,
      select: {
        id: true,
        headline: true,
        status: true,
        cardType: true,
        riskFlags: true,
        confidence: true,
        topic: { select: { id: true, title: true, aiTitle: true, publisherCount: true, firstSeenAt: true, genre: { select: { slug: true } } } },
      },
    }),
    prisma.edition.count({ where: { slot: "BREAKING", date: jstDate(now), status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } }),
  ]);
  // 世間の関心がある出来事だけを出す（候補が多すぎて選べないため。運営者の方針。2026-10-04）
  const kept = [];
  for (const st of stories) {
    if (kept.length >= take) break;
    if (await publicInterest({ title: st.topic.aiTitle || st.topic.title, publisherCount: st.topic.publisherCount, sports: st.topic.genre.slug === "sports" })) kept.push(st);
  }
  return { stories: kept, postedToday };
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
  /** 24時間に知らせる上限（世間の関心がある出来事だけに絞ったうえで） */
  maxPerDay: 5,
} as const;

type HotTopic = { id: number; title?: string | null; publisherCount: number; firstSeenAt: Date; lastSeenAt?: Date | null };

/** 知らせる出来事を選ぶ（まだ知らせていない・一斉に報じられている。判定は src/lib/stories/hot.ts） */
export function pickHotTopics<T extends HotTopic>(topics: T[], notified: Set<number>, now: Date, sentToday: number, max: number = HOT_RULES.maxPerDay): T[] {
  const room = Math.max(0, max - sentToday);
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

/**
 * 速報の確認のたびに呼ぶ。一斉に報じられ（src/lib/stories/hot.ts）、世間の関心がある（publicInterest）出来事があれば、
 * 人の確認を待たずに AI（無料の定期実行）に確認を頼み、条件に合えばそのまま投稿させる（運営者の方針。2026-10-04）。
 * 投稿の可否の安全条件（事件・訃報・選挙・政治は出さない、噂・宣伝は出さない、確からしさ、1日の上限）は pickBreaking のまま。
 * 深夜は災害だけ。定期実行を起動できないときは、これまでどおり運営者に知らせる
 */
export async function notifyHotTopics(now = new Date()) {
  const since = new Date(now.getTime() - HOT.withinHours * 3_600_000);
  const [topics, logs] = await Promise.all([
    prisma.topic.findMany({
      where: { firstSeenAt: { gte: since }, mergedIntoId: null, aiNotNews: false, stories: { some: { kind: "NEW" } } },
      orderBy: { firstSeenAt: "desc" },
      take: 500,
      select: {
        id: true,
        title: true,
        aiTitle: true,
        publisherCount: true,
        firstSeenAt: true,
        lastSeenAt: true,
        genre: { select: { slug: true } },
        stories: { where: { kind: "NEW" }, select: { id: true }, take: 1 },
      },
    }),
    prisma.eventLog.findMany({ where: { scope: "breaking.hot", at: { gte: new Date(now.getTime() - 24 * 3_600_000) } }, select: { ref: true, data: true } }),
  ]);
  let sportsAsked = logs.filter((l) => (l.data as { sports?: boolean } | null)?.sports).length;
  const notified = new Set(logs.map((l) => Number(l.ref)));
  // 一斉に報じられた出来事（媒体の多い順）から、世間の関心があるものだけを、1日の上限まで
  const hot = pickHotTopics(topics, notified, now, 0, Infinity);
  const room = Math.max(0, HOT_RULES.maxPerDay - logs.length);
  const quiet = isQuietHour(now);
  const { fireBreakingRoutine, routineFireReady } = await import("./routine");
  let picked = 0;
  for (const t of hot) {
    if (picked >= room) break;
    const title = t.aiTitle || t.title;
    if (quiet && !isDisasterTitle(title)) continue;
    const sports = t.genre.slug === "sports";
    if (sports && sportsAsked >= BREAKING_RULES.maxSportsPerDay) continue;
    const interest = await publicInterest({ title, publisherCount: t.publisherCount, sports });
    if (!interest) continue;
    picked++;
    if (sports) sportsAsked++;
    const storyId = t.stories[0].id;
    await logEvent("info", "breaking.hot", `速報の候補: ${title}（${interest}）`, String(t.id), { publishers: t.publisherCount, interest, sports });
    // 速報・注目のニュースとしてすでに出していれば何もしない
    const posted = await prisma.editionItem.count({ where: { storyId, edition: { slot: { in: ["BREAKING", "PICKUP"] } } } });
    if (posted) continue;
    if (routineFireReady()) {
      try {
        await fireBreakingRoutine({ storyId, topicId: t.id, title });
        await logEvent("info", REQUEST_SCOPE, `AI に確認を依頼（自動）: ${title}`, storyId, { auto: true });
        continue;
      } catch (e) {
        await logEvent("error", "breaking.hot", "AI への確認の依頼に失敗", storyId, String(e));
      }
    }
    const minutes = Math.max(1, Math.round((now.getTime() - t.firstSeenAt.getTime()) / 60_000));
    await notifyOwner({
      title: `速報の候補：${title}`.slice(0, 60),
      what: `「${title}」（${hotReason(t, now.getTime())}・${interest}）。最初の報道から${minutes}分で、${t.publisherCount}媒体が報じています。自動で AI に確認を頼めなかったため、お知らせします。`,
      action: "下のボタンから、ログインせずに操作できます（6時間有効）。出さない場合は対応は不要です。",
      url: quickUrl(storyId),
      button: "速報の操作画面を開く",
    });
  }
  return picked;
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
// 注目のニュース（速報の表示なし。人が選んで出すほか、日中は自動でも1本ずつ出す。src/lib/digest/pickup-auto.ts）
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
export async function createPickup(storyId: string, now = new Date(), headline?: string[], layout: CardLayout = "points", approvedBy = "admin") {
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
        approvedBy,
        postText: pickupPostText(edited ?? story.headline),
        items: { create: [{ position: 1, storyId: story.id, role: "MAIN", ...itemOverride(edited, layout) }] },
      },
      select: { id: true },
    })
    .catch(() => null);
}
