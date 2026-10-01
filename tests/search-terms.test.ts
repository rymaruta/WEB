import { describe, expect, it } from "vitest";
import { parseSearchTerms, rankSearchResults } from "@/lib/search-terms";

describe("parseSearchTerms", () => {
  it("半角・全角の空白で語に分ける", () => {
    expect(parseSearchTerms("高市 首相　会見")).toEqual(["高市", "首相", "会見"]);
  });
  it("空の語と重複を除き、5語までにする", () => {
    expect(parseSearchTerms("  a  a b c d e f ")).toEqual(["a", "b", "c", "d", "e"]);
    expect(parseSearchTerms("   ")).toEqual([]);
  });
});

describe("rankSearchResults", () => {
  it("見出しにすべての語を含むものを先に、それぞれ元の順で並べる", () => {
    const items = [
      { id: 1, title: "名古屋のバスで新しい決済", aiTitle: null },
      { id: 2, title: "トヨタが新型車", aiTitle: null },
      { id: 3, title: "部品メーカーの決算", aiTitle: "トヨタ向け部品が好調" },
    ];
    expect(rankSearchResults(items, ["トヨタ"])).toEqual([2, 3, 1]);
  });
});
