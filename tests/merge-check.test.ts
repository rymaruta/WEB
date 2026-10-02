import { describe, expect, it } from "vitest";
import { checkMerge, keyTerms, sharedTerms } from "@/lib/topics/merge-check";

const at = (h: number) => new Date(Date.UTC(2026, 9, 2, h));

describe("checkMerge", () => {
  it("同じ人の同じ出来事はまとめてよい（短い語が長い語に含まれる場合も共通）", () => {
    expect(sharedTerms("久保が結婚", "サッカー久保建英と電撃婚")).toContain("久保");
    expect(checkMerge({ title: "久保建英と福原遥が結婚", firstSeenAt: at(1) }, { title: "福原遥が電撃婚", firstSeenAt: at(5) }).ok).toBe(true);
  });

  it("共通の固有の語がなければまとめない（「発表」「速報」などは数えない）", () => {
    expect(keyTerms("【速報】新商品を発表")).toEqual(new Set(["新商品"]));
    expect(checkMerge({ title: "日銀が利上げを発表", firstSeenAt: at(1) }, { title: "トヨタが新型車を発表", firstSeenAt: at(2) })).toEqual({
      ok: false,
      reason: "見出しに共通の固有の語がない",
    });
  });

  it("時期が離れすぎていればまとめない", () => {
    const r = checkMerge({ title: "台風10号が上陸", firstSeenAt: at(0) }, { title: "台風10号の被害", firstSeenAt: new Date(at(0).getTime() + 100 * 3_600_000) });
    expect(r.ok).toBe(false);
  });
});
