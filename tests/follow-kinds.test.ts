import { describe, expect, it } from "vitest";
import { followingHref, parseFollowParams } from "@/lib/follow-kinds";

describe("parseFollowParams", () => {
  it("種類:キーの形だけを読み、重複と知らない種類を捨てる", () => {
    expect(parseFollowParams(["company:トヨタ", "team:tigers", "company:トヨタ", "xxx:a", "word:", "nocolon"])).toEqual([
      { kind: "company", key: "トヨタ" },
      { kind: "team", key: "tigers" },
    ]);
    expect(parseFollowParams("word:薬屋のひとりごと")).toEqual([{ kind: "word", key: "薬屋のひとりごと" }]);
    expect(parseFollowParams(undefined)).toEqual([]);
  });
  it("キーの中のコロンはそのまま、長すぎるキーは切る、20件まで", () => {
    expect(parseFollowParams("word:Re:ゼロ")).toEqual([{ kind: "word", key: "Re:ゼロ" }]);
    expect(parseFollowParams(`word:${"あ".repeat(60)}`)[0].key).toHaveLength(40);
    expect(parseFollowParams(Array.from({ length: 30 }, (_, i) => `word:w${i}`))).toHaveLength(20);
  });
});

describe("followingHref", () => {
  it("フォローをアドレスに入れる", () => {
    expect(followingHref([])).toBe("/following");
    expect(followingHref([{ kind: "company", key: "トヨタ" }, { kind: "word", key: "a b" }])).toBe(
      `/following?f=${encodeURIComponent("company:トヨタ")}&f=word%3Aa+b`,
    );
  });
});
