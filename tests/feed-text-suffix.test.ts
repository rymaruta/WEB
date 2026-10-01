import { describe, expect, it } from "vitest";
import { cleanTitle } from "@/lib/feed/text";

describe("cleanTitle（欄の名前）", () => {
  it("末尾の欄の名前を取り除く", () => {
    expect(cleanTitle("【独自】ホンダ社長の懐刀がソフトバンク入り | ビジネス")).toBe("【独自】ホンダ社長の懐刀がソフトバンク入り");
    expect(cleanTitle("米中の「戦略的安定」と台湾の影 | 政治・経済・投資")).toBe("米中の「戦略的安定」と台湾の影");
  });
  it("見出しの一部は残す", () => {
    expect(cleanTitle("新型車の価格 | 300万円から")).toBe("新型車の価格 | 300万円から");
  });
});
