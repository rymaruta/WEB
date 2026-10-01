import { describe, expect, it } from "vitest";
import { parseSearchTerms } from "@/lib/search-terms";

describe("parseSearchTerms", () => {
  it("半角・全角の空白で語に分ける", () => {
    expect(parseSearchTerms("高市 首相　会見")).toEqual(["高市", "首相", "会見"]);
  });
  it("空の語と重複を除き、5語までにする", () => {
    expect(parseSearchTerms("  a  a b c d e f ")).toEqual(["a", "b", "c", "d", "e"]);
    expect(parseSearchTerms("   ")).toEqual([]);
  });
});
