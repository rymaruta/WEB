import { cosine, IdfModel } from "./similarity";

/**
 * 急上昇の並びを整える。伸びの大きい順に見ていき、
 * - 同じジャンルは maxPerGenre 件まで（1つの分野ばかりにならないように）
 * - 見出しが似ている話題は、同じ出来事として先に選んだ1件だけ残す
 *   （同じ試合の選手コメントや監督会見などが別の話題として並ぶのを防ぐ）
 */
export const RISING_RULES = {
  maxPerGenre: 2,
  /** 見出しの類似度がこれ以上なら同じ出来事とみなす */
  sameEventSimilarity: 0.2,
} as const;

export type RisingCandidate = { id: number; title: string; genreId: number; rise: number; score: number };

export function diversifyRising<T extends RisingCandidate>(candidates: T[], take: number): T[] {
  const sorted = [...candidates].sort((a, b) => b.rise - a.rise || b.score - a.score);
  // 候補どうしで比べるので、候補の見出しだけで重みを付ける（2件以上に出る語だけが効く）
  const idf = new IdfModel(
    sorted.map((c) => c.title),
    1,
    2,
  );
  const vectors = new Map(sorted.map((c) => [c.id, idf.vector(c.title)]));
  const picked: T[] = [];
  const perGenre = new Map<number, number>();
  for (const c of sorted) {
    if (picked.length >= take) break;
    if ((perGenre.get(c.genreId) ?? 0) >= RISING_RULES.maxPerGenre) continue;
    const v = vectors.get(c.id)!;
    if (picked.some((p) => cosine(v, vectors.get(p.id)!) >= RISING_RULES.sameEventSimilarity)) continue;
    picked.push(c);
    perGenre.set(c.genreId, (perGenre.get(c.genreId) ?? 0) + 1);
  }
  return picked;
}
