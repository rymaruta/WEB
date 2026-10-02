import type { Assessment, Category } from "@/lib/stories/schema";
import type { SlotConfig } from "./slots";

/**
 * 配信回に載せるストーリーを選ぶ。DB に依存しない。
 * 話題の大きさ（媒体数）は候補に入る条件にだけ使い、順位は影響・信頼性・重要度で決める（仕様 5 章）。
 */

export type Candidate = {
  id: string;
  kind: "NEW" | "FOLLOWUP";
  status: string;
  category: Category | null;
  threadId: string | null;
  assessment: Assessment | null;
  publisherCount: number;
  hasPrimary: boolean;
  confidence: number | null;
  clicks: number;
  /** SNS での反応（はてなブックマーク数の合計） */
  social?: number;
  /**
   * 要確認（REVIEW_REQUIRED）でも、おまかせ投稿で載せてよいか。
   * 理由が「慎重に扱う分野」だけで、媒体間の食い違いがなく、多くの媒体が報じた公式の発表など（build.ts で判定）
   */
  autoOk?: boolean;
  /** 続報の場合、新しい事実の数 */
  newFacts?: number;
};

/** 要確認でも、おまかせ投稿で載せてよい分野（事実の報道として扱えるもの）。訃報・戦争・医療は人が確かめる */
export const AUTO_OK_RISKS = new Set(["POLITICS", "ELECTION", "MARKET", "CRIME", "ACCIDENT", "DISASTER"]);
export const AUTO_OK_MIN_PUBLISHERS = 3;
export const AUTO_OK_MIN_CONFIDENCE = 0.8;

/**
 * 要確認のストーリーを、おまかせ投稿で載せてよいか。
 * - 要確認の理由が「慎重に扱う分野」だけ（文字数・出典・資料にない語・写しすぎ・確からしさ・媒体間の食い違いは含まない）
 * - その分野が AUTO_OK_RISKS だけ
 * - 3媒体以上が報じ、照合の確からしさが 0.8 以上、ゴシップでない
 * 例: 所属事務所が契約解除を発表し、4媒体が報じた（事件の分野） → 載せてよい
 */
export function isAutoReviewable(s: {
  status: string;
  statusNote: string | null;
  riskFlags: string[];
  confidence: number | null;
  publisherCount: number;
  assessment: Assessment | null;
}): boolean {
  if (s.status !== "REVIEW_REQUIRED") return false;
  const reasons = (s.statusNote ?? "").split("\n").filter(Boolean);
  if (reasons.length === 0 || !reasons.every((r) => r.startsWith("慎重に扱う分野"))) return false;
  if (s.riskFlags.length === 0 || !s.riskFlags.every((f) => AUTO_OK_RISKS.has(f))) return false;
  return s.publisherCount >= AUTO_OK_MIN_PUBLISHERS && (s.confidence ?? 0) >= AUTO_OK_MIN_CONFIDENCE && !s.assessment?.gossip;
}

export type ScoreParts = { impact: number; reliability: number; longevity: number; novelty: number; interest: number; buzz: number; penalty: number };
export type Scored = { id: string; score: number; parts: ScoreParts };

/**
 * 配信の候補になる状態。REVIEW_REQUIRED は配信回の承認時に個別の確認が必要。
 * PUBLISHED は、夜の「今日これだけ」が今日の配信を振り返る場合だけ候補に渡される
 */
export const ELIGIBLE_STATUSES = new Set(["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"]);
/** これより低い点数のストーリーは、ふだんは載せない */
export const MIN_SCORE = 25;
/** 1回の配信は必ずこの本数にする（運営者の方針。足りない回は投稿しない） */
export const REQUIRED_ITEMS = 3;
/** 本数が足りないときに埋めに使える点数の下限 */
export const FILL_MIN_SCORE = 10;
const HARD_NEWS = new Set<Category>(["POLITICS", "ECONOMY", "WORLD"]);
const SOFT_NEWS = new Set<Category>(["ENTERTAINMENT", "SPORTS"]);
/** 同じカテゴリーは1回に2本まで */
const PER_CATEGORY = 2;
/** 芸能とスポーツは合わせて1本まで */
const SOFT_MAX = 1;
/** 閲覧数はこの値で頭打ちにする（関心だけで上位にならないように） */
const CLICKS_CAP = 300;
/** 話題性：報じた媒体の数と SNS の反応。それぞれこの値で頭打ち */
const BUZZ_PUBLISHERS_CAP = 10;
const BUZZ_SOCIAL_CAP = 300;

export function scoreCandidate(c: Candidate): Scored {
  const a = c.assessment;
  const impact = ((a?.impact ?? 1) / 3) * 35;
  const reliability = ((Math.min(c.publisherCount, 5) / 5) * 0.6 + (c.hasPrimary ? 0.2 : 0) + (c.confidence ?? 0.7) * 0.2) * 25;
  const longevity = ((a?.longevity ?? 1) / 3) * 20;
  const novelty = c.kind === "FOLLOWUP" ? Math.min(c.newFacts ?? 0, 2) * 5 : 10;
  const interest = (Math.min(c.clicks, CLICKS_CAP) / CLICKS_CAP) * 10;
  // 話題性（多くの媒体が報じている・SNS で反応が多い）。重要度とは別に、世の中で話題になっていることも評価する
  const buzz = (Math.min(c.publisherCount, BUZZ_PUBLISHERS_CAP) / BUZZ_PUBLISHERS_CAP) * 12 + (Math.min(c.social ?? 0, BUZZ_SOCIAL_CAP) / BUZZ_SOCIAL_CAP) * 8;
  let penalty = 0;
  if (a?.gossip) penalty += 40;
  if (a?.promotional) penalty += 20;
  if (a && a.publicInterest === 0) penalty += 10;
  const parts = { impact, reliability, longevity, novelty, interest, buzz, penalty };
  const score = Math.round((impact + reliability + longevity + novelty + interest + buzz - penalty) * 10) / 10;
  return { id: c.id, score, parts };
}

type Picked = Scored & { candidate: Candidate };

/** 3本に足りないときに埋める段階で、ゆるめた後の上限（同じカテゴリー・スポーツとエンタメの合計とも2本まで。3本とも同じにはしない） */
const RELAXED_MAX = 2;

function fits(picked: Picked[], c: Candidate, relaxed = false): boolean {
  if (c.threadId && picked.some((p) => p.candidate.threadId === c.threadId)) return false;
  if (c.category && picked.filter((p) => p.candidate.category === c.category).length >= (relaxed ? RELAXED_MAX : PER_CATEGORY)) return false;
  if (c.category && SOFT_NEWS.has(c.category) && picked.filter((p) => p.candidate.category && SOFT_NEWS.has(p.candidate.category)).length >= (relaxed ? RELAXED_MAX : SOFT_MAX))
    return false;
  return true;
}

export type Selection = {
  main: Scored[];
  followups: Scored[];
  /** 選定の記録（管理画面で「なぜ載らなかったか」を見せる） */
  notes: { candidates: number; eligible: number; belowMinScore: number; excludedThreads: number; filled: number };
};

/**
 * @param excludeThreads 前の配信回に載った出来事。新しい事実がない限り、もう一度は載せない
 * @param opts.verifiedOnly 人の確認が要る（REVIEW_REQUIRED）ストーリーを選ばない。おまかせ投稿の回で使う
 */
export function selectForEdition(candidates: Candidate[], cfg: SlotConfig, excludeThreads: Set<string>, opts: { verifiedOnly?: boolean } = {}): Selection {
  const scored = candidates.map((c) => ({ ...scoreCandidate(c), candidate: c }));
  const eligible = scored.filter(
    (s) => ELIGIBLE_STATUSES.has(s.candidate.status) && !(opts.verifiedOnly && s.candidate.status === "REVIEW_REQUIRED" && !s.candidate.autoOk),
  );
  const strong = eligible.filter((s) => s.score >= MIN_SCORE).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const excluded = strong.filter((s) => s.candidate.kind === "NEW" && s.candidate.threadId && excludeThreads.has(s.candidate.threadId));

  // 続報（結局どうなった）
  const followups: Picked[] = [];
  for (const s of strong.filter((x) => x.candidate.kind === "FOLLOWUP")) {
    if (followups.length >= cfg.followupMax) break;
    if (!s.candidate.threadId || !followups.some((f) => f.candidate.threadId === s.candidate.threadId)) followups.push(s);
  }
  const followupThreads = new Set(followups.map((f) => f.candidate.threadId).filter((t): t is string => !!t));

  // 本編。続報が少ない回は、その空き分だけ本数を増やす
  const mainLimit = Math.min(cfg.mainMax, cfg.mainCount + (cfg.followupMax - followups.length));
  const pool = strong.filter(
    (s) => s.candidate.kind === "NEW" && !(s.candidate.threadId && (excludeThreads.has(s.candidate.threadId) || followupThreads.has(s.candidate.threadId))),
  );
  const main: Picked[] = [];
  for (const s of pool) {
    if (main.length >= mainLimit) break;
    if (fits(main, s.candidate)) main.push(s);
  }

  // 政治・経済・国際を1本以上（候補があれば、いちばん点数の低い1本と入れ替える）
  const isHard = (p: Picked) => !!p.candidate.category && HARD_NEWS.has(p.candidate.category);
  if (cfg.requireHardNews && main.length > 0 && !main.some(isHard)) {
    const hard = pool.find((s) => isHard(s) && !main.includes(s));
    if (hard) {
      const rest = main.slice(0, -1);
      if (main.length < mainLimit && fits(main, hard.candidate)) main.push(hard);
      else if (fits(rest, hard.candidate)) main.splice(main.length - 1, 1, hard);
    }
  }

  // 3本に足りなければ埋める。まず点数の基準をゆるめ、それでも足りなければカテゴリーの上限もゆるめる（ゆるめても同じカテゴリーは2本まで）。
  // ゴシップ・宣伝と、人の確認が要るもの（verifiedOnly のとき）は使わない
  const need = () => REQUIRED_ITEMS - main.length - followups.length;
  if (need() > 0) {
    const usedThreads = new Set([...main, ...followups].map((p) => p.candidate.threadId).filter((t): t is string => !!t));
    const filler = eligible
      .filter(
        (s) =>
          s.candidate.kind === "NEW" &&
          !main.includes(s) &&
          s.score >= FILL_MIN_SCORE &&
          !s.candidate.assessment?.gossip &&
          !s.candidate.assessment?.promotional &&
          !(s.candidate.threadId && (excludeThreads.has(s.candidate.threadId) || followupThreads.has(s.candidate.threadId))),
      )
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    for (const relaxCategories of [false, true]) {
      for (const s of filler) {
        if (need() <= 0) break;
        if (main.includes(s)) continue;
        if (s.candidate.threadId && usedThreads.has(s.candidate.threadId)) continue;
        if (!fits(main, s.candidate, relaxCategories)) continue;
        main.push(s);
        if (s.candidate.threadId) usedThreads.add(s.candidate.threadId);
      }
    }
  }

  const strip = ({ id, score, parts }: Picked): Scored => ({ id, score, parts });
  return {
    main: main.sort((a, b) => b.score - a.score).map(strip),
    followups: followups.map(strip),
    notes: {
      candidates: candidates.length,
      eligible: eligible.length,
      belowMinScore: eligible.length - strong.length,
      excludedThreads: excluded.length,
      // 基準点に届かない候補で埋めた本数
      filled: main.filter((m) => m.score < MIN_SCORE).length,
    },
  };
}
