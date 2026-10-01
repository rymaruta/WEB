import { cleanTitle } from "@/lib/feed/text";
import { publisherLabel } from "@/lib/publisher";
import { cosine, IdfModel, normalizeForMatch } from "./similarity";

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

export type RisingRow = { topicId: number; publisher: string; first: Date; title: string };

/**
 * 話題ごとに、直近 since 以降と、それより前の「報道の数」を数える。
 * 同じ見出しの記事（配信元の記事を別の媒体がそのまま転載したもの）は、媒体が違っても1つの報道として数える。
 * 媒体数をそのまま数えると、1本の記事の転載が「2媒体が報道」として急上昇に並んでしまうため。
 */
export function countReports(rows: RisingRow[], since: Date): Map<number, { recent: number; before: number; publishers: number }> {
  const byTopic = new Map<number, { recent: Set<string>; before: Set<string>; publishers: number }>();
  for (const r of [...rows].sort((a, b) => a.first.getTime() - b.first.getTime())) {
    let t = byTopic.get(r.topicId);
    if (!t) byTopic.set(r.topicId, (t = { recent: new Set(), before: new Set(), publishers: 0 }));
    const key = normalizeForMatch(cleanTitle(r.title, [publisherLabel(r.publisher)])).replace(/\s+/g, "");
    if (r.first >= since) {
      t.publishers++;
      // 以前から同じ見出しで出ていた記事の転載は、新しい報道に数えない
      if (!t.before.has(key)) t.recent.add(key);
    } else t.before.add(key);
  }
  return new Map([...byTopic].map(([id, t]) => [id, { recent: t.recent.size, before: t.before.size, publishers: t.publishers }]));
}
