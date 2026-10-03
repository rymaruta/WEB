import { describe, expect, it } from "vitest";
import { aiSummary, displayExcerpt, displayImage } from "@/lib/rights";
import { sources } from "../prisma/catalog";

describe("媒体の利用規約に基づく見せ方（lib/rights）", () => {
  it("媒体の画像は、規約で認める媒体（PR TIMES）のものだけ表示する", () => {
    expect(displayImage("https://example.com/a.jpg", "ITmedia")).toBeNull();
    expect(displayImage("https://example.com/a.jpg", "4Gamer.net")).toBeNull();
    expect(displayImage("https://prcdn.freetls.fastly.net/release_image/1/2/a.png", "PR TIMES")).toMatch(/^https/);
    expect(displayImage("", "PR TIMES")).toBeNull();
  });

  it("説明文は規約で認める媒体（4Gamer.net・PR TIMES）だけ表示する", () => {
    expect(displayExcerpt("説明", "4Gamer.net")).toBe("説明");
    expect(displayExcerpt("説明", "PR TIMES")).toBe("説明");
    expect(displayExcerpt("説明", "ITmedia")).toBeNull();
    expect(displayExcerpt(null, "PR TIMES")).toBeNull();
  });

  it("要約・AI での利用を禁じる媒体の説明文は AI に渡さない", () => {
    expect(aiSummary("説明", "東洋経済オンライン")).toBeNull();
    expect(aiSummary("説明", "時事ドットコム")).toBeNull();
    expect(aiSummary("説明", "ITmedia")).toBe("説明");
  });

  it("営利利用・自動収集を禁じる媒体のフィードは収集しない", () => {
    const off = (re: RegExp) => sources.filter((s) => re.test(s.feedUrl)).every((s) => s.active === false);
    for (const re of [/jiji\.com/, /toyokeizai/, /diamond\.jp/, /gendai\.media/, /gekisaka/, /bbci/, /jisin\.jp/, /b\.hatena\.ne\.jp/]) expect(off(re)).toBe(true);
    expect(sources.find((s) => /4gamer/.test(s.feedUrl))?.active).not.toBe(false);
  });
});
