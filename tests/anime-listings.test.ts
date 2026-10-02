import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { animePageTitle, parseAnimePage } = await import("@/lib/anime-listings");

// Wikipedia「日本のテレビアニメ作品一覧 (2020年代 後半)」の形（一部）
const html = `
<h2 id="2026年（令和8年）">2026年</h2>
<h3 id="2026年_7月_-_9月">7月 - 9月</h3>
<table class="wikitable"><tbody>
<tr><th>開始日 - 終了日</th><th>作品名</th><th>制作会社</th><th>主放送局・系列</th><th>話数</th></tr>
<tr><td>7月5日 - 9月20日</td><td><a rel="mw:WikiLink" href="x">夏の作品</a></td><td>A</td><td>TOKYO MXほか</td><td>全12話</td></tr>
</tbody></table>
<h3 id="2026年_10月_-_12月">10月 - 12月</h3>
<table class="wikitable"><tbody>
<tr><td colspan="5">この節には放送開始前の番組に関する記述があります。</td></tr>
<tr><th>開始日 - 終了日</th><th>作品名</th><th>制作会社</th><th>主放送局・系列</th><th>話数</th></tr>
<tr><td>10月1日 -</td><td><a rel="mw:WikiLink" href="y">FX戦士くるみちゃん</a></td><td>パッショーネ</td><td>AT-Xほか</td><td></td></tr>
<tr><td>10月11日 -</td><td><a rel="mw:WikiLink" href="z">夜桜さんちの大作戦</a>（第2期・第2クール）</td><td>SILVER LINK.</td><td>MBS・TBS</td><td></td></tr>
<tr><td>11月 -</td><td>月だけの作品 &amp; その2</td><td>B</td><td></td><td></td></tr>
</tbody></table>
<h2 id="2027年（令和9年）">2027年</h2>
<h3 id="2027年_1月_-_3月">1月 - 3月</h3>
<table class="wikitable"><tbody>
<tr><td>1月8日 -</td><td>来年の作品</td><td>C</td><td>CX</td><td></td></tr>
</tbody></table>`;

describe("parseAnimePage", () => {
  it("季節ごとの表から、作品名・放送開始日・放送局を読む", () => {
    expect(parseAnimePage(html)).toEqual([
      { title: "夏の作品", start: "2026-07-05", channel: "TOKYO MXほか" },
      { title: "FX戦士くるみちゃん", start: "2026-10-01", channel: "AT-Xほか" },
      { title: "夜桜さんちの大作戦（第2期・第2クール）", start: "2026-10-11", channel: "MBS・TBS" },
      { title: "月だけの作品 & その2", start: "2026-11", channel: null },
      { title: "来年の作品", start: "2027-01-08", channel: "CX" },
    ]);
  });
});

describe("animePageTitle", () => {
  it("10年ごとの前半・後半のページを選ぶ", () => {
    expect(animePageTitle(2026)).toBe("日本のテレビアニメ作品一覧 (2020年代 後半)");
    expect(animePageTitle(2030)).toBe("日本のテレビアニメ作品一覧 (2030年代 前半)");
  });
});
