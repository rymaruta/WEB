import { CATEGORY_LABELS, LIMITS, RISK_LABELS, type StoryAnalysis, type StoryMaterial } from "./schema";
import { normalize, textWidth } from "./text";

/** 照合の結果。AI の出力をそのまま信用せず、機械的に確かめる */
export type VerifyResult = {
  status: "PENDING" | "REVIEW_REQUIRED" | "REJECTED_AUTO";
  /** 人に見せる理由（要確認・除外の説明） */
  notes: string[];
  /** 整えた出力（空白の除去、範囲外の出典番号の削除、本文への【カテゴリー】付与） */
  cleaned: StoryAnalysis & { postLines: string[] };
  /** 資料に見つからなかった語 */
  missingFacts: string[];
};

/** 煽り表現。見出し・要点・本文に含まれていたら人の確認に回す */
export const BANNED_WORDS = ["衝撃", "ヤバ", "やば", "必見", "絶対見", "まさか", "炎上", "驚愕", "震撼", "大炎上", "神回", "閲覧注意", "拡散希望", "【悲報】", "【朗報】"];

/** 写しすぎの判定に使う連続一致の長さ。見出し・要点・本文は上限が短く届かないため、要約だけを検査する */
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

export function verifyAnalysis(raw: StoryAnalysis, materials: StoryMaterial[]): VerifyResult {
  const notes: string[] = [];
  let review = false;

  const trimLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);
  const label = CATEGORY_LABELS[raw.category];
  const postBody = trimLines(raw.postText);
  const tag = raw.cardType === "BREAKING" ? "【速報】" : `【${label}】`;
  const postLines = postBody.length ? [tag + postBody[0], ...postBody.slice(1)] : [];
  const points = raw.points
    .map((p) => ({
      text: p.text.trim(),
      sources: [...new Set(p.sources)].filter((n) => n >= 1 && n <= materials.length).sort((a, b) => a - b),
    }))
    .filter((p) => p.text);
  const cleaned = { ...raw, headline: trimLines(raw.headline), summary: raw.summary.trim(), points, postText: postBody, postLines };

  if (!raw.sufficient) {
    return { status: "REJECTED_AUTO", notes: ["資料だけでは内容を確かめられない（AI の判定）"], cleaned, missingFacts: [] };
  }

  // 文字数と構成
  const { headline } = cleaned;
  if (headline.length < 1 || headline.length > LIMITS.headlineLines) notes.push(`見出しは1〜${LIMITS.headlineLines}行（今は${headline.length}行）`);
  headline.forEach((l, i) => {
    if (textWidth(l) > LIMITS.headlineWidth) notes.push(`見出し${i + 1}行目が${textWidth(l)}字（上限${LIMITS.headlineWidth}字）`);
  });
  if (points.length < LIMITS.pointsMin || points.length > LIMITS.pointsMax) notes.push(`要点は${LIMITS.pointsMin}〜${LIMITS.pointsMax}個（今は${points.length}個）`);
  points.forEach((p, i) => {
    if (textWidth(p.text) > LIMITS.pointWidth) notes.push(`要点${i + 1}が${textWidth(p.text)}字（上限${LIMITS.pointWidth}字）`);
    if (p.sources.length === 0) notes.push(`要点${i + 1}に出典の番号がない`);
  });
  if (postLines.length < 1 || postLines.length > LIMITS.postLines) notes.push(`投稿本文は1〜${LIMITS.postLines}行（今は${postLines.length}行）`);
  postLines.forEach((l, i) => {
    if (textWidth(l) > LIMITS.postWidth) notes.push(`投稿本文${i + 1}行目が${textWidth(l)}字（上限${LIMITS.postWidth}字）`);
  });
  if (notes.length) review = true;

  // 煽り表現
  const visible = [...headline, ...points.map((p) => p.text), ...postLines, cleaned.summary].join("\n");
  const banned = BANNED_WORDS.filter((w) => visible.includes(w));
  if (banned.length) {
    review = true;
    notes.push(`使わない表現が含まれる: ${banned.join("、")}`);
  }
  if (/[#＃]\S/.test(postLines.join(" "))) {
    review = true;
    notes.push("投稿本文にハッシュタグがある");
  }

  // 事実の照合（資料にない数字・固有名詞・カギかっこの語）
  const sourceText = materials.map((m) => `${m.title}\n${m.summary ?? ""}`).join("\n");
  const missingFacts = extractFacts(visible).filter((f) => !factInSources(f, sourceText) && !Object.values(CATEGORY_LABELS).includes(f));
  if (missingFacts.length) {
    review = true;
    notes.push(`資料に見つからない語: ${missingFacts.join("、")}`);
  }

  // 写しすぎ（要約）
  for (const m of materials) {
    if (longestCommonRun(cleaned.summary, `${m.title}\n${m.summary ?? ""}`) >= COPY_RUN) {
      review = true;
      notes.push(`要約が${m.publisher}の文と${COPY_RUN}字以上一致`);
      break;
    }
  }

  // 慎重な扱いが必要な分野と確度
  if (raw.riskFlags.length) {
    review = true;
    notes.push(`慎重に扱う分野: ${raw.riskFlags.map((f) => RISK_LABELS[f]).join("、")}`);
  }
  if (raw.confidence < CONFIDENCE_MIN) {
    review = true;
    notes.push(`確からしさが低い（${raw.confidence.toFixed(2)}）`);
  }
  if (raw.conflicts.length) {
    review = true;
    notes.push(`媒体間の食い違い: ${raw.conflicts.map((c) => c.about).join("、")}`);
  }

  return { status: review ? "REVIEW_REQUIRED" : "PENDING", notes, cleaned, missingFacts };
}
