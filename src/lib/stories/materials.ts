/** AI に渡す資料の選び方。DB に依存しない */

/** AI に渡す資料の最大数（同じ媒体は1本だけ） */
const MAX_MATERIALS = 10;
/** 続報の候補にするのに必要な、新しく報じた媒体の数（公式発表なら1つでよい） */
const FOLLOWUP_MIN_PUBLISHERS = 2;

export type ArticleRef = { id: number; publisher: string; isPrimary: boolean; publishedAt: Date };

/** 同じ媒体は最初の1本だけにして、資料の上限まで選ぶ */
export function pickMaterials<T extends { publisher: string }>(articles: T[]): T[] {
  const seen = new Set<string>();
  return articles.filter((a) => (seen.has(a.publisher) ? false : (seen.add(a.publisher), true))).slice(0, MAX_MATERIALS);
}

/**
 * 前回の配信の後に出た記事から、続報の資料を選ぶ。前回の資料に使った記事は除く。
 * 新しく報じた媒体が足りなければ null（同じ記事の再配信や、1媒体だけの続報は扱わない）
 */
export function pickFollowupMaterials(articles: ArticleRef[], publishedAt: Date, usedIds: Set<number>): ArticleRef[] | null {
  const fresh = pickMaterials(articles.filter((a) => a.publishedAt > publishedAt && !usedIds.has(a.id)));
  const enough = fresh.length >= FOLLOWUP_MIN_PUBLISHERS || fresh.some((a) => a.isPrimary);
  return enough ? fresh : null;
}
