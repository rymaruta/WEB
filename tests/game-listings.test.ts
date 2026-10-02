import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { nintendoDate, parseSteamResults, pickNintendo, steamDate, titleKey } = await import("@/lib/game-listings");

const item = (over: Partial<Parameters<typeof pickNintendo>[0][number]>) => ({
  nsuid: "1",
  id: "1",
  title: "作品",
  sdate: "2026.10.8",
  hard: "1_HAC",
  sform: "HAC_DL",
  maker: "どこか",
  price: 5000,
  ...over,
});

describe("pickNintendo", () => {
  it("Switch 版と Switch 2 版を1件にまとめ、追加コンテンツと安い小品は載せない", () => {
    const out = pickNintendo([
      item({ nsuid: "1", title: "ドラゴンクエストモンスターズ４", hard: "1_HAC", sform: "HAC_DOWNLOADABLE" }),
      item({ nsuid: "2", title: "ドラゴンクエストモンスターズ４", hard: "05_BEE", sform: "BEE_DOWNLOADABLE" }),
      item({ nsuid: "3", title: "追加ステージ", sform: "DLC" }),
      item({ nsuid: "4", title: "間違い探し", price: 420 }),
      item({ nsuid: "5", title: "安いけど大手", price: 990, maker: "カプコン" }),
      item({ nsuid: "6", title: "日付未定", sdate: "2026年冬" }),
    ]);
    expect(out.map((l) => [l.externalId, l.title, l.release, l.platforms])).toEqual([
      ["1", "ドラゴンクエストモンスターズ４", "2026-10-08", ["Switch 2", "Switch"]],
      ["5", "安いけど大手", "2026-10-08", ["Switch"]],
    ]);
    expect(out[0].url).toBe("https://store-jp.nintendo.com/item/software/D1");
  });
  it("日付の形", () => {
    expect(nintendoDate("2026.12.3")).toBe("2026-12-03");
    expect(nintendoDate("未定")).toBeNull();
  });
});

describe("Steam", () => {
  it("日付は日か月まで分かるものだけ", () => {
    expect(steamDate("2026年10月5日")).toBe("2026-10-05");
    expect(steamDate("2026年10月")).toBe("2026-10");
    expect(steamDate("近日登場")).toBeNull();
  });
  it("検索結果から作品名・日付・ページを読む", () => {
    const html = `<a href="x" data-ds-appid="3393110" class="search_result_row"><span class="title">AION 2 &amp; more</span><div class="search_released responsive_secondrow">2026年10月5日</div></a>
<a data-ds-appid="9" ><span class="title">未定の作品</span><div class="search_released">近日登場</div></a>`;
    expect(parseSteamResults(html)).toEqual([
      { source: "steam", externalId: "3393110", title: "AION 2 & more", release: "2026-10-05", platforms: ["PC"], maker: null, url: "https://store.steampowered.com/app/3393110/" },
    ]);
  });
});

describe("titleKey", () => {
  it("記号・空白・機種名の付け足しの違いを吸収する", () => {
    expect(titleKey("地球防衛軍5 for Nintendo Switch 2")).toBe(titleKey("地球防衛軍５"));
    expect(titleKey("Stellar Blade™ コンプリートエディション")).toBe(titleKey("Stellar Blade コンプリート エディション"));
  });
});
