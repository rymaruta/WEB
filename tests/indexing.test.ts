import { describe, expect, it } from "vitest";
import { isIndexableArticle, jsonLength } from "@/lib/indexing";

describe("isIndexableArticle", () => {
  const base = { publisherCount: 2, hasAi: true, angles: 0, background: 0 };
  it("3媒体以上、または報じ方の違いか経緯があるまとめ記事だけを登録する", () => {
    expect(isIndexableArticle({ ...base, publisherCount: 3 })).toBe(true);
    expect(isIndexableArticle({ ...base, angles: 1 })).toBe(true);
    expect(isIndexableArticle({ ...base, background: 2 })).toBe(true);
    expect(isIndexableArticle(base)).toBe(false);
  });
  it("まとめ記事がなければ登録しない", () => {
    expect(isIndexableArticle({ ...base, publisherCount: 9, hasAi: false })).toBe(false);
  });
});

describe("jsonLength", () => {
  it("配列でなければ 0", () => {
    expect(jsonLength([1, 2])).toBe(2);
    expect(jsonLength(null)).toBe(0);
    expect(jsonLength({ a: 1 })).toBe(0);
  });
});

describe("要点の数と編集部の点検", () => {
  const base = { publisherCount: 5, hasAi: true, angles: 0, background: 0 };
  it("要点が3つ未満の記事は登録しない（数が分からなければ従来どおり）", () => {
    expect(isIndexableArticle({ ...base, points: 2 })).toBe(false);
    expect(isIndexableArticle({ ...base, points: 3 })).toBe(true);
    expect(isIndexableArticle(base)).toBe(true);
  });
  it("編集部が「検索から外す」とした記事は登録しない", () => {
    expect(isIndexableArticle({ ...base, points: 4, held: true })).toBe(false);
  });
});

describe("aiIndexCounts（サイトマップと話題ページで同じ数え方）", async () => {
  const { aiIndexCounts } = await import("@/lib/ai/article");
  it("表示で落ちる読者向けでない要点・報じ方は数えない", () => {
    const pts = [
      { text: "A社が新製品を発表した。", sources: [1] },
      { text: "資料には価格は書かれていない。", sources: [1] },
      { text: "B社も追随した。", sources: [2] },
    ];
    expect(aiIndexCounts({ aiPoints: pts, aiAngles: [{ text: "資料には違いはない。", sources: [1] }], aiBackground: null })).toEqual({ points: 2, angles: 0, background: 0 });
  });
  it("形の正しくない値は0", () => expect(aiIndexCounts({ aiPoints: "x", aiAngles: [{ bad: 1 }] })).toEqual({ points: 0, angles: 0, background: 0 }));
});
