import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { photoNames } from "@/lib/photos";
import { readPhoto } from "@/lib/photo-data";
import { STOCK_PHOTOS, stockPhoto } from "@/lib/stock-photos";

describe("話題の写真（lib/photos）", () => {
  it("見出しの人名を写真を探す候補にする", () => {
    expect(photoNames("久保建英選手と女優の福原遥さんが結婚を発表")).toEqual(expect.arrayContaining(["久保建英", "福原遥"]));
    expect(photoNames("広島、小園海斗ら4選手と来季契約結ばず")).toContain("小園海斗");
  });

  it("事件・事故・訃報などの話題では人の写真を探さない", () => {
    expect(photoNames("立花孝志被告、自身が襲われた事件の裁判で被告に質問")).toEqual([]);
    expect(photoNames("俳優の〇〇さんが死去")).toEqual([]);
    expect(photoNames("〇〇容疑者を逮捕")).toEqual([]);
  });

  it("保存した写真の値を読む（形が違えば null）", () => {
    expect(readPhoto({ url: "https://upload.wikimedia.org/a.jpg", page: "https://commons.wikimedia.org/wiki/File:A.jpg", credit: "X / CC BY-SA 4.0" })).toMatchObject({ credit: "X / CC BY-SA 4.0" });
    expect(readPhoto(null)).toBeNull();
    expect(readPhoto({ url: "x" })).toBeNull();
  });
});

describe("イメージ写真（lib/stock-photos）", () => {
  it("すべて Wikimedia Commons の自由利用ライセンスで、作者・ライセンスがある", () => {
    for (const p of STOCK_PHOTOS) {
      expect(p.url).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      expect(p.page).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(p.credit).toMatch(/(CC0|Public domain|PD|CC BY)/i);
    }
  });

  it("主なジャンルに既定の写真がある", () => {
    for (const g of ["domestic", "world", "business", "tech", "entertainment"]) {
      expect(stockPhoto("きょうのできごと", g, 1)).not.toBeNull();
    }
  });
});

describe("イメージ写真の選び方", () => {
  it("見出しの語に合う写真を選ぶ", () => {
    expect(stockPhoto("日銀が利上げを決定", "business", 3)?.page).toMatch(/Bank_of_Japan|%E6%97%A5%E6%9C%AC%E9%8A%80%E8%A1%8C|BOJ|Nihon/i);
    expect(stockPhoto("衆院で法案が可決", "domestic", 3)?.page).toMatch(/Diet/);
  });
});
