import { LIMITS } from "@/lib/stories/schema";
import { textWidth } from "@/lib/stories/text";
import type { ItemOverride } from "./build";

/** 文字数の上限を確かめる。超えていれば理由の一覧を返す */
export function checkOverride(o: ItemOverride): string[] {
  const notes: string[] = [];
  const over = (label: string, s: string, max: number) => {
    if (textWidth(s) > max) notes.push(`${label}が${textWidth(s)}字です（上限${max}字）`);
  };
  if (o.headline) {
    if (o.headline.length < 1 || o.headline.length > LIMITS.headlineLines) notes.push(`見出しは1〜${LIMITS.headlineLines}行です`);
    o.headline.forEach((l, i) => over(`見出し${i + 1}行目`, l, LIMITS.headlineWidth));
  }
  if (o.shortTitle !== undefined) over("一覧用の見出し", o.shortTitle, LIMITS.shortTitleWidth);
  if (o.keyword !== undefined) over("キーワード", o.keyword, LIMITS.keywordWidth);
  if (o.points) {
    if (o.points.length < LIMITS.pointsMin || o.points.length > LIMITS.pointsMax) notes.push(`要点は${LIMITS.pointsMin}〜${LIMITS.pointsMax}個です`);
    o.points.forEach((p, i) => over(`要点${i + 1}`, p.text, LIMITS.pointWidth));
  }
  if (o.why) over("なぜ重要", o.why.text, LIMITS.whyWidth);
  return notes;
}

export type QualityItem = { category: string | null; threadId: string | null; headline: string[]; sources: number };

/**
 * おまかせ投稿の前の品質チェック。止める理由（blocking）と、記録だけ残す注意（warnings）を返す
 * - 止める: 全部が同じ分野、同じ出来事が2本、見出しがない、出典がない
 * - 注意: 芸能・スポーツが過半で、政治・経済・国際・社会がない
 */
export function editionQualityProblems(items: QualityItem[]): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const cats = items.map((i) => i.category);
  if (items.length > 1 && cats.every((c) => c && c === cats[0])) blocking.push(`${items.length}本とも同じ分野（${cats[0]}）`);
  const threads = items.map((i) => i.threadId).filter((t): t is string => !!t);
  if (new Set(threads).size < threads.length) blocking.push("同じ出来事が2本以上");
  items.forEach((i, n) => {
    if (i.headline.every((l) => !l.trim())) blocking.push(`${n + 1}本目に見出しがない`);
    if (i.sources === 0) blocking.push(`${n + 1}本目に出典がない`);
  });
  const soft = cats.filter((c) => c === "ENTERTAINMENT" || c === "SPORTS").length;
  const hard = cats.filter((c) => c === "POLITICS" || c === "ECONOMY" || c === "WORLD" || c === "SOCIETY").length;
  if (soft * 2 > items.length && hard === 0) warnings.push(`芸能・スポーツが${soft}本で、社会・政治・経済・国際がない`);
  return { blocking, warnings };
}
