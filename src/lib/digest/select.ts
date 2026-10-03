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
  /** 話題の id（前の回に出した話題を除くため） */
  topicId?: number;
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

/** 要確認でも、おまかせ投稿で載せてよい分野（事実の報道として扱えるもの） */
export const AUTO_OK_RISKS = new Set(["POLITICS", "ELECTION", "MARKET", "CRIME", "ACCIDENT", "DISASTER"]);
export const AUTO_OK_MIN_PUBLISHERS = 3;
export const AUTO_OK_MIN_CONFIDENCE = 0.8;
/** 訃報・戦争・医療は、独立した媒体4社以上（通信社・NHK などの信頼できる媒体を含む）が報じ、確からしさが特に高いときだけ */
export const AUTO_OK_STRICT_RISKS = new Set(["DEATH", "WAR", "MEDICAL"]);
export const AUTO_OK_STRICT = { minPublishers: 4, minConfidence: 0.85 } as const;

/**
 * 要確認のストーリーを、おまかせ投稿で載せてよいか（人の確認はしない。運営者の方針。2026-10-03）。
 * - 要確認の理由が「慎重に扱う分野」だけ（文字数・出典・資料にない語・写しすぎ・確からしさ・媒体間の食い違いは含まない）
 * - 事件で人名が出てくるもの（実名の容疑者など）は使わない。ゴシップは使わない
 * - AUTO_OK_RISKS の分野は、3媒体以上が報じ、確からしさ 0.8 以上
 * - 訃報・戦争・医療（AUTO_OK_STRICT_RISKS）は、独立した媒体4社以上・信頼できる媒体を含み、確からしさ 0.85 以上
 * 例: 所属事務所が契約解除を発表し、4媒体が報じた（事件の分野、人名なし） → 載せてよい
 */
export function isAutoReviewable(s: {
  status: string;
  statusNote: string | null;
  riskFlags: string[];
  confidence: number | null;
  publisherCount: number;
  assessment: Assessment | null;
  /** 信頼できる媒体（通信社・全国紙・NHK など）が報じているか */
  trusted?: boolean;
  /** 解析で読み取った人名があるか */
  hasPeople?: boolean;
}): boolean {
  if (s.status !== "REVIEW_REQUIRED") return false;
  const reasons = (s.statusNote ?? "").split("\n").filter(Boolean);
  if (reasons.length === 0 || !reasons.every((r) => r.startsWith("慎重に扱う分野"))) return false;
  if (s.riskFlags.length === 0 || s.assessment?.gossip) return false;
  if (s.riskFlags.includes("CRIME") && s.hasPeople) return false;
  const strict = s.riskFlags.some((f) => AUTO_OK_STRICT_RISKS.has(f));
  if (!s.riskFlags.every((f) => AUTO_OK_RISKS.has(f) || AUTO_OK_STRICT_RISKS.has(f))) return false;
  if (strict) return s.publisherCount >= AUTO_OK_STRICT.minPublishers && (s.confidence ?? 0) >= AUTO_OK_STRICT.minConfidence && s.trusted === true;
  return s.publisherCount >= AUTO_OK_MIN_PUBLISHERS && (s.confidence ?? 0) >= AUTO_OK_MIN_CONFIDENCE;
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

/**
 * 3つの枠（運営者の方針。2026-10-03）。1回の配信は、各枠から点数のいちばん高い1本ずつを選ぶ。
 * 分野が自然にばらけ、「なぜこの3本か」を説明しやすくする
 */
export const FRAMES: { key: string; label: string; categories: Category[] }[] = [
  { key: "hard", label: "社会・政治・経済・国際", categories: ["SOCIETY", "POLITICS", "ECONOMY", "WORLD"] },
  { key: "life", label: "暮らし・テック・科学", categories: ["LIFE", "TECH", "SCIENCE"] },
  { key: "soft", label: "スポーツ・芸能", categories: ["SPORTS", "ENTERTAINMENT"] },
];

export const frameOf = (c: Category | null): string | null => (c ? (FRAMES.find((f) => f.categories.includes(c))?.key ?? null) : null);

/** 選定の記録に残す、載らなかった候補の数（点数の高い順） */
const REJECTED_LOG = 20;

export type Selection = {
  main: Scored[];
  followups: Scored[];
  /** 選定の記録（管理画面で「なぜ載らなかったか」を見せる） */
  notes: {
    candidates: number;
    eligible: number;
    belowMinScore: number;
    excludedThreads: number;
    filled: number;
    /** 各枠に入った候補（枠の key → ストーリーの id。埋め合わせなら null） */
    frames?: Record<string, string | null>;
    /** 載らなかった候補と理由（点数の高い順に REJECTED_LOG 件） */
    rejected: { id: string; score: number; reason: string }[];
  };
};

/**
 * 1回の配信の3本を選ぶ。
 * 1. 各枠（FRAMES）から、点数のいちばん高い1本（基準点 MIN_SCORE 以上を優先、なければ FILL_MIN_SCORE 以上）
 * 2. 候補のない枠は、ほかの枠の2番手以降で埋める（まだ使っていない分野を優先）。必ず REQUIRED_ITEMS 本にする
 * - 前の回・速報で出した出来事（excludeThreads）、ゴシップ・宣伝（基準点未満のとき）、同じ出来事の2本目は使わない
 * - 人の確認が要るもの（REVIEW_REQUIRED）は、おまかせ投稿（verifiedOnly）では autoOk のものだけ使う
 * - 続報（FOLLOWUP）も同じ枠で競う（cfg.followupMax 本まで。新しい事実があり、基準点以上のときだけ）
 * @param excludeThreads 前の配信回に載った出来事。新しい事実がない限り、もう一度は載せない
 */
export function selectForEdition(candidates: Candidate[], cfg: SlotConfig, excludeThreads: Set<string>, opts: { verifiedOnly?: boolean } = {}): Selection {
  const scored = candidates.map((c) => ({ ...scoreCandidate(c), candidate: c }));
  const blockedByReview = (c: Candidate) => opts.verifiedOnly === true && c.status === "REVIEW_REQUIRED" && !c.autoOk;
  const eligible = scored.filter((s) => ELIGIBLE_STATUSES.has(s.candidate.status) && !blockedByReview(s.candidate));
  const excludedNew = (c: Candidate) => c.kind === "NEW" && !!c.threadId && excludeThreads.has(c.threadId);
  const usable = (s: Picked) => {
    const c = s.candidate;
    if (excludedNew(c)) return false;
    if (c.kind === "FOLLOWUP") return s.score >= MIN_SCORE && (c.newFacts ?? 0) > 0;
    if (s.score < FILL_MIN_SCORE) return false;
    if (s.score < MIN_SCORE && (c.assessment?.gossip || c.assessment?.promotional)) return false;
    return true;
  };
  const pool = eligible.filter(usable).sort((a, b) => Number(b.score >= MIN_SCORE) - Number(a.score >= MIN_SCORE) || b.score - a.score || a.id.localeCompare(b.id));

  const picked: Picked[] = [];
  const frames: Record<string, string | null> = {};
  const threads = new Set<string>();
  const canTake = (s: Picked) => {
    if (picked.includes(s)) return false;
    if (s.candidate.threadId && threads.has(s.candidate.threadId)) return false;
    if (s.candidate.kind === "FOLLOWUP" && picked.filter((p) => p.candidate.kind === "FOLLOWUP").length >= cfg.followupMax) return false;
    return true;
  };
  const take = (s: Picked) => {
    picked.push(s);
    if (s.candidate.threadId) threads.add(s.candidate.threadId);
  };

  // 1. 各枠から1本
  for (const f of FRAMES) {
    const s = pool.find((x) => frameOf(x.candidate.category) === f.key && canTake(x));
    frames[f.key] = s?.id ?? null;
    if (s) take(s);
  }
  // 2. 足りない分を埋める（まだ使っていない分野 → どれでも）
  for (const pass of ["new-category", "any"] as const) {
    for (const s of pool) {
      if (picked.length >= REQUIRED_ITEMS) break;
      if (!canTake(s)) continue;
      if (pass === "new-category" && s.candidate.category && picked.some((p) => p.candidate.category === s.candidate.category)) continue;
      take(s);
    }
  }

  // 載らなかった理由（管理画面と選定の記録で「なぜ載らなかったか」を見せる）
  const chosen = new Set(picked.map((p) => p.id));
  const reasonOf = (s: Picked): string => {
    const c = s.candidate;
    if (!ELIGIBLE_STATUSES.has(c.status)) return `状態が対象外（${c.status}）`;
    if (blockedByReview(c)) return "人の確認が必要（おまかせ投稿では使わない）";
    if (excludedNew(c)) return "前の配信回に載った出来事";
    if (c.kind === "FOLLOWUP" && (s.score < MIN_SCORE || !(c.newFacts ?? 0))) return `続報の点数不足（${s.score}）`;
    if (s.score < FILL_MIN_SCORE) return `点数不足（${s.score}）`;
    if (s.score < MIN_SCORE && (c.assessment?.gossip || c.assessment?.promotional)) return "ゴシップ・宣伝（埋め合わせに使わない）";
    if (c.threadId && threads.has(c.threadId)) return "同じ出来事がすでに載る";
    const frame = frameOf(c.category);
    return frame && frames[frame] ? `同じ枠（${FRAMES.find((f) => f.key === frame)!.label}）の上位が載る` : "本数の上限";
  };
  const rejected = scored
    .filter((s) => !chosen.has(s.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, REJECTED_LOG)
    .map((s) => ({ id: s.id, score: s.score, reason: reasonOf(s) }));

  // 表示の順：枠の順（社会・政治 → 暮らし → スポーツ・芸能 → 枠のないもの）。続報は最後
  const order = (p: Picked) => (p.candidate.kind === "FOLLOWUP" ? 9 : FRAMES.findIndex((f) => f.key === frameOf(p.candidate.category)) + 1 || 4);
  const strip = ({ id, score, parts }: Picked): Scored => ({ id, score, parts });
  const main = picked.filter((p) => p.candidate.kind === "NEW").sort((a, b) => order(a) - order(b) || b.score - a.score);
  return {
    main: main.map(strip),
    followups: picked.filter((p) => p.candidate.kind === "FOLLOWUP").map(strip),
    notes: {
      candidates: candidates.length,
      eligible: eligible.length,
      belowMinScore: eligible.filter((s) => s.score < MIN_SCORE).length,
      excludedThreads: eligible.filter((s) => excludedNew(s.candidate)).length,
      // 基準点に届かない候補で埋めた本数
      filled: picked.filter((m) => m.score < MIN_SCORE).length,
      frames,
      rejected,
    },
  };
}
