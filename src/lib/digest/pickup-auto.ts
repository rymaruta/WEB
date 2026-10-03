import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { famousSubject } from "@/lib/fame";
import { createPickup } from "./breaking";
import { loadCandidates } from "./build";
import { publishEdition } from "./publish";
import { frameOf, MIN_SCORE, scoreCandidate, type Candidate } from "./select";
import { jstDate, jstTime } from "./slots";

/**
 * 日中の「注目のニュース」の自動投稿（運営者の方針。2026-10-03）。
 * 昼・夜の3本まとめをやめ、多くの媒体が報じた大きなニュースを、確定しだい1本ずつ、見出しを大きく見せるカードで出す
 * （X ではニュースは早さが大事で、まとめて数時間後に出すより伸びやすいため）。
 * - 8時〜22時台。前の投稿（定時・速報・注目のニュース）から60分以上あける。1日8本まで
 * - 最初の報道から12時間以内。独立した媒体3社以上。照合を通ったもの（要確認は自動で使ってよいものだけ）。確からしさ 0.8 以上
 * - ゴシップ・宣伝は出さない。30時間以内に X に出したニュース（同じ話題・同じ出来事）は出さない
 * - 直前に出した枠（社会・政治／暮らし・テック／スポーツ・芸能）と違う枠を優先する
 * - ゲーム・アニメ・新商品は、1つの告知を多くの媒体が一斉に載せやすいため、世間の関心がある（誰もが知っている作品・会社）ときだけ
 */
/** 告知が多く、媒体の数が関心の高さを示さないジャンル */
export const PROMO_GENRES = new Set(["game", "anime", "products"]);

/** 日中の自動投稿の条件 */
export const AUTO_PICKUP = {
  fromHour: 8,
  untilHour: 23,
  minGapMinutes: 60,
  maxPerDay: 8,
  maxAgeHours: 12,
  minPublishers: 3,
  minConfidence: 0.8,
  lookbackHours: 30,
} as const;

export function autoPickupEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AUTO_PICKUP !== "false" && env.AUTO_PUBLISH !== "false";
}

const jstHour = (at: Date) => Number(jstTime(at).split(":")[0]);

export type PickupCandidate = Candidate & { score: number };

/** 自動で出してよい候補か（純粋な判断。テスト用） */
export function pickupOk(c: PickupCandidate): boolean {
  if (c.kind !== "NEW") return false;
  if (!(c.status === "PENDING" || c.status === "APPROVED" || (c.status === "REVIEW_REQUIRED" && c.autoOk))) return false;
  if (c.publisherCount < AUTO_PICKUP.minPublishers) return false;
  if ((c.confidence ?? 0) < AUTO_PICKUP.minConfidence) return false;
  if (c.assessment?.gossip || c.assessment?.promotional) return false;
  return c.score >= MIN_SCORE;
}

/** 候補から1本を選ぶ（直前の枠と違う枠を優先し、その中で点数の高いもの）。なければ null */
export function pickAutoPickup(candidates: PickupCandidate[], lastFrame: string | null): PickupCandidate | null {
  const ok = candidates.filter(pickupOk);
  const differs = (c: PickupCandidate) => Number(frameOf(c.category) !== lastFrame);
  return ok.sort((a, b) => differs(b) - differs(a) || b.score - a.score || a.id.localeCompare(b.id))[0] ?? null;
}

/** 出せる時間か（時間帯・前の投稿からの間隔・今日の本数）。出せなければ理由 */
export function pickupWindow(now: Date, lastPostAt: Date | null, postedToday: number): string | null {
  const h = jstHour(now);
  if (h < AUTO_PICKUP.fromHour || h >= AUTO_PICKUP.untilHour) return "quiet";
  if (postedToday >= AUTO_PICKUP.maxPerDay) return "limit";
  if (lastPostAt && now.getTime() - lastPostAt.getTime() < AUTO_PICKUP.minGapMinutes * 60_000) return "gap";
  return null;
}

/** 定期的に呼ぶ。条件に合えば1本だけ投稿する */
export async function runAutoPickup(now = new Date()) {
  if (!autoPickupEnabled()) return { result: "disabled" as const };
  const date = jstDate(now);
  const since = new Date(now.getTime() - AUTO_PICKUP.lookbackHours * 3_600_000);
  const [postedToday, last, recent] = await Promise.all([
    prisma.edition.count({ where: { slot: "PICKUP", date, approvedBy: "auto-pickup", status: { in: ["APPROVED", "PUBLISHED", "FAILED"] } } }),
    prisma.edition.findFirst({
      where: { status: { in: ["APPROVED", "PUBLISHED"] }, publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true, slot: true, items: { take: 1, select: { story: { select: { category: true } } } } },
    }),
    prisma.editionItem.findMany({
      where: { edition: { status: { in: ["APPROVED", "PUBLISHED", "FAILED"] }, scheduledAt: { gte: since } } },
      select: { storyId: true, story: { select: { topicId: true, eventThreadId: true } } },
    }),
  ]);
  const closed = pickupWindow(now, last?.publishedAt ?? null, postedToday);
  if (closed) return { result: closed };

  const stories = new Set(recent.map((r) => r.storyId));
  const topics = new Set(recent.map((r) => r.story.topicId));
  const threads = new Set(recent.map((r) => r.story.eventThreadId).filter((t): t is string => !!t));
  const candidates = (await loadCandidates(new Date(now.getTime() - AUTO_PICKUP.maxAgeHours * 3_600_000), false))
    .filter((c) => !stories.has(c.id) && !(c.topicId !== undefined && topics.has(c.topicId)) && !(c.threadId && threads.has(c.threadId)))
    .map((c) => ({ ...c, score: scoreCandidate(c).score }));
  // ゲーム・アニメ・新商品は、世間の関心がある（よく知られた作品・会社）ものだけ候補に残す
  const kept: typeof candidates = [];
  for (const c of candidates) {
    // 媒体の数では判断しない（告知は一斉に載る）。よく知られた作品・会社のときだけ（例: 任天堂、ポケモン）
    if (c.genre && PROMO_GENRES.has(c.genre) && !(await famousSubject(c.title ?? "").catch(() => null))) continue;
    kept.push(c);
  }
  const lastFrame = last?.slot === "PICKUP" || last?.slot === "BREAKING" ? frameOf((last.items[0]?.story.category as Candidate["category"]) ?? null) : null;
  const pick = pickAutoPickup(kept, lastFrame);
  if (!pick) return { result: "none" as const, candidates: candidates.length };

  const edition = await createPickup(pick.id, now, undefined, "headline", "auto-pickup");
  if (!edition) return { result: "duplicate" as const };
  try {
    await publishEdition(edition.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEvent("error", "pickup.auto", `注目のニュースの自動投稿に失敗`, edition.id, message);
    return { result: "failed" as const, editionId: edition.id, error: message };
  }
  await logEvent("info", "pickup.auto", `注目のニュースを自動で投稿（${pick.category ?? "分野なし"}・${pick.publisherCount}媒体・${pick.score}点）`, edition.id, { storyId: pick.id });
  return { result: "published" as const, editionId: edition.id };
}
