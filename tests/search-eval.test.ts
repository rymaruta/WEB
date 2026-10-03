import { describe, expect, it } from "vitest";
import data from "./fixtures/search-eval.json";
import { parseSearchTerms, rankSearchResults, termVariants } from "@/lib/search-terms";

/**
 * 検索の精度の測定（テストデータ）。
 * 当たり: 見出しに語を含むか（データベースの大文字・小文字を区別しない部分一致と同じ）
 * 並び: 正解が上位に来ているか（正解の数だけの上位に、正解がいくつ入るか）
 */
const NOW = Date.UTC(2026, 9, 3, 3);
const topics = data.topics.map((t) => ({ ...t, lastSeenAt: new Date(NOW - t.day * 86_400_000), publisherCount: t.pubs }));
const ilike = (text: string, v: string) => text.toLowerCase().includes(v.toLowerCase());

/** 改善前: 語をそのまま部分一致・見出しに全語を含むものを先に、新しい順 */
function before(q: string): number[] {
  const terms = parseSearchTerms(q);
  const hits = topics.filter((t) => terms.every((v) => ilike(`${t.title} ${t.aiTitle ?? ""}`, v))).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  return hits.map((t) => t.id);
}

/** 改善後: 表記ゆれのどれかで部分一致・並びは rankSearchResults */
function after(q: string): number[] {
  const terms = parseSearchTerms(q);
  const hits = topics.filter((t) => terms.every((term) => termVariants(term).some((v) => ilike(`${t.title} ${t.aiTitle ?? ""}`, v)))).sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  return rankSearchResults(hits, terms);
}

function score(run: (q: string) => number[]) {
  let found = 0, relevant = 0, topHits = 0;
  for (const { q, relevant: rel } of data.queries) {
    const ids = run(q);
    relevant += rel.length;
    found += rel.filter((id) => ids.includes(id)).length;
    topHits += ids.slice(0, rel.length).filter((id) => rel.includes(id)).length;
  }
  return { recall: found / relevant, precisionAtK: topHits / relevant };
}

describe("検索の精度（テストデータ12問）", () => {
  it("改善後は、全角・半角、ひらがな・カタカナ、略称の違いがあっても見つかる", () => {
    const b = score(before);
    const a = score(after);
    // 測定値: 改善前 再現率 0.60（15/25）・上位の精度 0.60 → 改善後 1.00（25/25）・1.00
    expect(b.recall).toBeLessThan(0.7);
    expect(a.recall).toBe(1);
    expect(a.precisionAtK).toBe(1);
  });

  it("同じ日の中では、報じた媒体の多い話題を先にする", () => {
    expect(after("AI")[0]).toBe(2);
  });
});
