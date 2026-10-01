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
  /** 続報の場合、新しい事実の数 */
  newFacts?: number;
};

export type ScoreParts = { impact: number; reliability: number; longevity: number; novelty: number; interest: number; penalty: number };
export type Scored = { id: string; score: number; parts: ScoreParts };

/**
 * 配信の候補になる状態。REVIEW_REQUIRED は配信回の承認時に個別の確認が必要。
 * PUBLISHED は、夜の「今日これだけ」が今日の配信を振り返る場合だけ候補に渡される
 */
export const ELIGIBLE_STATUSES = new Set(["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"]);
/** これより低い点数のストーリーは載せない（本数が足りなくても埋めない） */
export const MIN_SCORE = 25;
const HARD_NEWS = new Set<Category>(["POLITICS", "ECONOMY", "WORLD"]);
const SOFT_NEWS = new Set<Category>(["ENTERTAINMENT", "SPORTS"]);
/** 同じカテゴリーは1回に2本まで */
const PER_CATEGORY = 2;
/** 芸能とスポーツは合わせて1本まで */
const SOFT_MAX = 1;
/** 閲覧数はこの値で頭打ちにする（関心だけで上位にならないように） */
const CLICKS_CAP = 300;

export function scoreCandidate(c: Candidate): Scored {
  const a = c.assessment;
  const impact = ((a?.impact ?? 1) / 3) * 35;
  const reliability = ((Math.min(c.publisherCount, 5) / 5) * 0.6 + (c.hasPrimary ? 0.2 : 0) + (c.confidence ?? 0.7) * 0.2) * 25;
  const longevity = ((a?.longevity ?? 1) / 3) * 20;
  const novelty = c.kind === "FOLLOWUP" ? Math.min(c.newFacts ?? 0, 2) * 5 : 10;
  const interest = (Math.min(c.clicks, CLICKS_CAP) / CLICKS_CAP) * 10;
  let penalty = 0;
  if (a?.gossip) penalty += 40;
  if (a?.promotional) penalty += 20;
  if (a && a.publicInterest === 0) penalty += 10;
  const parts = { impact, reliability, longevity, novelty, interest, penalty };
  const score = Math.round((impact + reliability + longevity + novelty + interest - penalty) * 10) / 10;
  return { id: c.id, score, parts };
}

type Picked = Scored & { candidate: Candidate };

function fits(picked: Picked[], c: Candidate): boolean {
  if (c.threadId && picked.some((p) => p.candidate.threadId === c.threadId)) return false;
  if (c.category && picked.filter((p) => p.candidate.category === c.category).length >= PER_CATEGORY) return false;
  if (c.category && SOFT_NEWS.has(c.category) && picked.filter((p) => p.candidate.category && SOFT_NEWS.has(p.candidate.category)).length >= SOFT_MAX) return false;
  return true;
}

export type Selection = {
  main: Scored[];
  followups: Scored[];
  /** 選定の記録（管理画面で「なぜ載らなかったか」を見せる） */
  notes: { candidates: number; eligible: number; belowMinScore: number; excludedThreads: number };
};

/**
 * @param excludeThreads 前の配信回に載った出来事。新しい事実がない限り、もう一度は載せない
 */
export function selectForEdition(candidates: Candidate[], cfg: SlotConfig, excludeThreads: Set<string>): Selection {
  const scored = candidates.map((c) => ({ ...scoreCandidate(c), candidate: c }));
  const eligible = scored.filter((s) => ELIGIBLE_STATUSES.has(s.candidate.status));
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

  const strip = ({ id, score, parts }: Picked): Scored => ({ id, score, parts });
  return {
    main: main.sort((a, b) => b.score - a.score).map(strip),
    followups: followups.map(strip),
    notes: {
      candidates: candidates.length,
      eligible: eligible.length,
      belowMinScore: eligible.length - strong.length,
      excludedThreads: excluded.length,
    },
  };
}
