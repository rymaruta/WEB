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
    for (const g of ["domestic", "world", "business", "tech", "entertainment", "sports"]) {
      expect(stockPhoto("きょうのできごと", g, 1)).not.toBeNull();
    }
  });
});

describe("イメージ写真の選び方", () => {
  it("見出しの語に合う写真を選ぶ", () => {
    expect(stockPhoto("日銀が利上げを決定", "business", 3)?.page).toMatch(/Bank_of_Japan|%E6%97%A5%E6%9C%AC%E9%8A%80%E8%A1%8C|BOJ|Nihon/i);
    expect(stockPhoto("衆院で法案が可決", "domestic", 3)?.page).toMatch(/Diet/);
  });

  it("球団名など企業・地名と同じ語は、スポーツの話題でだけ使う", () => {
    expect(stockPhoto("ヤクルトが新商品を発売", "products", 1)).toBeNull();
    expect(stockPhoto("ヤクルト山田哲人が決勝打", "sports", 1)?.page).toMatch(/Jingu|Stadium|Koshien|baseball|Baseball|Tokyo_Dome|File:/);
  });
});

describe("人物写真の問い合わせ", () => {
  it("ヘッダーは ASCII だけ（日本語を入れると送信前に失敗する）。ページがなければ null", async () => {
    const { lookupPersonPhoto } = await import("@/lib/photos");
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response("", { status: 404 });
    });
    await expect(lookupPersonPhoto("山田太郎")).resolves.toBeNull();
    const ua = (calls[0].headers as Record<string, string>)["User-Agent"];
    expect(ua).toMatch(/^[\x20-\x7e]+$/);
    vi.unstubAllGlobals();
  });

  it("通信の失敗は例外にする（「写真なし」と記録しない）", async () => {
    const { lookupPersonPhoto } = await import("@/lib/photos");
    vi.stubGlobal("fetch", async () => new Response("", { status: 429 }));
    await expect(lookupPersonPhoto("山田太郎")).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("企業発表の代表画像", () => {
  it("PR TIMES の og:image を、一覧向けの大きさの URL にする", async () => {
    const { pressImageUrl } = await import("@/lib/photos");
    const html = '<meta property="og:image" content="https://prcdn.freetls.fastly.net/release_image/135002/159/a-2722x1815.png?format=jpeg&amp;auto=webp&amp;width=2400&amp;height=1260"/>';
    expect(pressImageUrl(html)).toBe("https://prcdn.freetls.fastly.net/release_image/135002/159/a-2722x1815.png?format=jpeg&auto=webp&fit=bounds&width=800&height=450");
    expect(pressImageUrl('<meta property="og:image" content="https://example.com/x.png"/>')).toBeNull();
    expect(pressImageUrl("<html></html>")).toBeNull();
  });
});
