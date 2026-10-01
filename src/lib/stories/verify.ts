import { CATEGORY_LABELS, LIMITS, RISK_LABELS, type FollowupAnalysis, type PreviousCoverage, type Sourced, type StoryAnalysis, type StoryMaterial } from "./schema";
import { normalize, textWidth } from "./text";

/** 照合の結果。AI の出力をそのまま信用せず、機械的に確かめる */
export type VerifyResult = {
  status: "PENDING" | "REVIEW_REQUIRED" | "REJECTED_AUTO";
  /** 人に見せる理由（要確認・除外の説明） */
  notes: string[];
  /** 整えた出力（空白の除去、範囲外の出典番号の削除） */
  cleaned: StoryAnalysis;
  /** 資料に見つからなかった語 */
  missingFacts: string[];
};

/** 煽り表現。見出し・要点などに含まれていたら人の確認に回す */
export const BANNED_WORDS = ["衝撃", "ヤバ", "やば", "必見", "絶対見", "まさか", "炎上", "驚愕", "震撼", "大炎上", "神回", "閲覧注意", "拡散希望", "【悲報】", "【朗報】"];

/** 写しすぎの判定に使う連続一致の長さ。見出し・要点は上限が短く届かないため、要約だけを検査する */
const COPY_RUN = 30;
const CONFIDENCE_MIN = 0.7;

/** 照合の対象にする「事実の語」。数字・カギかっこ内の語・英数字の語 */
export function extractFacts(text: string): string[] {
  const t = text.normalize("NFKC");
  const facts = new Set<string>();
  for (const m of t.matchAll(/\d[\d,.]*/g)) facts.add(m[0].replace(/,/g, "").replace(/\.$/, ""));
  for (const m of t.matchAll(/「([^」]{1,30})」/g)) facts.add(m[1]);
  for (const m of t.matchAll(/[A-Za-z][A-Za-z0-9.+&'-]*(?: [A-Za-z0-9][A-Za-z0-9.+&'-]*)*/g)) {
    if (m[0].length >= 2) facts.add(m[0]);
  }
  return [...facts];
}

/** 資料の中に語があるか（正規化して比較）。数字は「1」が「10」に含まれる誤判定を避けるため前後を確かめる */
export function factInSources(fact: string, sourceText: string): boolean {
  const f = normalize(fact);
  if (!/^\d[\d.]*$/.test(f)) return normalize(sourceText).includes(f);
  // 数字は空白を消さずに比べる（「F1 25」の空白を消すと「125」になり、境目を誤るため）
  const s = sourceText.normalize("NFKC").replace(/(\d),(?=\d{3})/g, "$1");
  return new RegExp(`(^|[^\\d.])${f.replace(/\./g, "\\.")}($|[^\\d])`).test(s);
}

/** 資料と同じ文字列が長く続いていないか */
export function longestCommonRun(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  let best = 0;
  const prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    let diag = 0;
    for (let j = 1; j <= y.length; j++) {
      const tmp = prev[j];
      prev[j] = x[i - 1] === y[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = tmp;
    }
  }
  return best;
}

/** 出典番号を整える（重複・範囲外を除き、昇順に） */
function cleanSourced(p: Sourced, count: number): Sourced {
  return { text: p.text.trim(), sources: [...new Set(p.sources)].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b) };
}

function checkWidth(notes: string[], label: string, text: string, limit: number) {
  if (textWidth(text) > limit) notes.push(`${label}が${textWidth(text)}字（上限${limit}字）`);
}

/** 煽り表現と、資料に見つからない事実の語を調べる */
function checkWording(notes: string[], visible: string, sourceText: string): string[] {
  const banned = BANNED_WORDS.filter((w) => visible.includes(w));
  if (banned.length) notes.push(`使わない表現が含まれる: ${banned.join("、")}`);
  const missing = extractFacts(visible).filter((f) => !factInSources(f, sourceText) && !Object.values(CATEGORY_LABELS).includes(f));
  if (missing.length) notes.push(`資料に見つからない語: ${missing.join("、")}`);
  return missing;
}

export function verifyAnalysis(raw: StoryAnalysis, materials: StoryMaterial[]): VerifyResult {
  const notes: string[] = [];
  const trimLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);
  const points = raw.points.map((p) => cleanSourced(p, materials.length)).filter((p) => p.text);
  const why = raw.why && raw.why.text.trim() ? cleanSourced(raw.why, materials.length) : null;
  const cleaned: StoryAnalysis = {
    ...raw,
    headline: trimLines(raw.headline),
    summary: raw.summary.trim(),
    shortTitle: raw.shortTitle.trim(),
    keyword: raw.keyword.trim(),
    points,
    why,
  };

  if (!raw.sufficient) {
    return { status: "REJECTED_AUTO", notes: ["資料だけでは内容を確かめられない（AI の判定）"], cleaned, missingFacts: [] };
  }

  // 文字数と構成
  const { headline } = cleaned;
  if (headline.length < 1 || headline.length > LIMITS.headlineLines) notes.push(`見出しは1〜${LIMITS.headlineLines}行（今は${headline.length}行）`);
  headline.forEach((l, i) => checkWidth(notes, `見出し${i + 1}行目`, l, LIMITS.headlineWidth));
  if (points.length < LIMITS.pointsMin || points.length > LIMITS.pointsMax) notes.push(`要点は${LIMITS.pointsMin}〜${LIMITS.pointsMax}個（今は${points.length}個）`);
  points.forEach((p, i) => {
    checkWidth(notes, `要点${i + 1}`, p.text, LIMITS.pointWidth);
    if (p.sources.length === 0) notes.push(`要点${i + 1}に出典の番号がない`);
  });
  if (!cleaned.shortTitle) notes.push("一覧用の見出しがない");
  checkWidth(notes, "一覧用の見出し", cleaned.shortTitle, LIMITS.shortTitleWidth);
  if (!cleaned.keyword) notes.push("キーワードがない");
  checkWidth(notes, "キーワード", cleaned.keyword, LIMITS.keywordWidth);
  if (why) {
    checkWidth(notes, "「なぜ重要」", why.text, LIMITS.whyWidth);
    if (why.sources.length === 0) notes.push("「なぜ重要」に出典の番号がない");
  }

  // 煽り表現と事実の照合（資料にない数字・固有名詞・カギかっこの語）
  const visible = [...headline, cleaned.shortTitle, cleaned.keyword, ...points.map((p) => p.text), why?.text ?? "", cleaned.summary].join("\n");
  const sourceText = materials.map((m) => `${m.title}\n${m.summary ?? ""}`).join("\n");
  const missingFacts = checkWording(notes, visible, sourceText);

  // 写しすぎ（要約）
  for (const m of materials) {
    if (longestCommonRun(cleaned.summary, `${m.title}\n${m.summary ?? ""}`) >= COPY_RUN) {
      notes.push(`要約が${m.publisher}の文と${COPY_RUN}字以上一致`);
      break;
    }
  }

  // 慎重な扱いが必要な分野と確度
  if (raw.riskFlags.length) notes.push(`慎重に扱う分野: ${raw.riskFlags.map((f) => RISK_LABELS[f]).join("、")}`);
  if (raw.confidence < CONFIDENCE_MIN) notes.push(`確からしさが低い（${raw.confidence.toFixed(2)}）`);
  if (raw.conflicts.length) notes.push(`媒体間の食い違い: ${raw.conflicts.map((c) => c.about).join("、")}`);

  return { status: notes.length ? "REVIEW_REQUIRED" : "PENDING", notes, cleaned, missingFacts };
}

export type FollowupVerifyResult = {
  status: "PENDING" | "REVIEW_REQUIRED" | "REJECTED_AUTO";
  notes: string[];
  cleaned: FollowupAnalysis;
  missingFacts: string[];
};

/**
 * 続報の差分を照合する。新しい事実がなければ除外する（同じニュースを繰り返し流さない）。
 * 「現在」と新しい事実は新しい資料と、「前回の時点」は前回の配信の内容と突き合わせる
 */
export function verifyFollowup(raw: FollowupAnalysis, materials: StoryMaterial[], previous: PreviousCoverage): FollowupVerifyResult {
  const notes: string[] = [];
  const newFacts = raw.newFacts.map((f) => cleanSourced(f, materials.length)).filter((f) => f.text);
  const cleaned: FollowupAnalysis = {
    ...raw,
    newFacts,
    before: raw.before.trim(),
    now: cleanSourced(raw.now, materials.length),
    shortTitle: raw.shortTitle.trim(),
  };
  if (!raw.sufficient) return { status: "REJECTED_AUTO", notes: ["新しい資料では内容を確かめられない（AI の判定）"], cleaned, missingFacts: [] };
  if (newFacts.length === 0) return { status: "REJECTED_AUTO", notes: ["前回の配信から新しい事実がない"], cleaned, missingFacts: [] };

  checkWidth(notes, "「前回の時点」", cleaned.before, LIMITS.deltaWidth);
  checkWidth(notes, "「現在」", cleaned.now.text, LIMITS.deltaWidth);
  checkWidth(notes, "一覧用の見出し", cleaned.shortTitle, LIMITS.shortTitleWidth);
  if (cleaned.now.sources.length === 0) notes.push("「現在」に出典の番号がない");
  newFacts.forEach((f, i) => {
    checkWidth(notes, `新しい事実${i + 1}`, f.text, LIMITS.deltaWidth);
    if (f.sources.length === 0) notes.push(`新しい事実${i + 1}に出典の番号がない`);
  });

  const sourceText = materials.map((m) => `${m.title}\n${m.summary ?? ""}`).join("\n");
  const previousText = [previous.keyword, ...previous.headline, previous.summary, ...previous.points].join("\n");
  const missingFacts = [
    ...checkWording(notes, [cleaned.now.text, cleaned.shortTitle, ...newFacts.map((f) => f.text)].join("\n"), `${sourceText}\n${previous.keyword}`),
    ...checkWording(notes, cleaned.before, previousText),
  ];
  if (raw.confidence < CONFIDENCE_MIN) notes.push(`確からしさが低い（${raw.confidence.toFixed(2)}）`);

  return { status: notes.length ? "REVIEW_REQUIRED" : "PENDING", notes, cleaned, missingFacts };
}
