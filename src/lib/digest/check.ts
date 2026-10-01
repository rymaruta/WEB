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
