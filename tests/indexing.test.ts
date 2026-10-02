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
