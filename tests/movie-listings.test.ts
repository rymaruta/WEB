import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { parseMoviePage } = await import("@/lib/movie-listings");

const html = `<h3 id="10月">10月</h3><ul>
<li id="a">9日
<ul id="b"><li id="c"><a rel="mw:WikiLink" href="https://ja.wikipedia.org/wiki/X" title="バイオハザード">バイオハザード</a>(<span><a href="https://ja.wikipedia.org/wiki/ファイル:Flag.svg" class="mw-file-description"><img></a></span><a rel="mw:WikiLink" href="https://ja.wikipedia.org/wiki/アメリカ合衆国" title="アメリカ合衆国">アメリカ合衆国</a>)</li>
<li id="d"><a rel="mw:WikiLink" href="https://ja.wikipedia.org/wiki/Y?action=edit&amp;redlink=1" class="new">小さな作品</a>(<a rel="mw:WikiLink" href="x">日本</a>)</li>
<li id="e"><a rel="mw:WikiLink" href="https://ja.wikipedia.org/wiki/Z">汝、星のごとく</a>(<a rel="mw:WikiLink" href="x">日本</a>)</li></ul></li>
</ul><h3 id="11月">11月</h3><ul>
<li id="f">3日
<ul id="g"><li id="h"><a rel="mw:WikiLink" href="https://ja.wikipedia.org/wiki/G">ゴジラ-0.0</a>(<a rel="mw:WikiLink" href="x">日本</a>)</li></ul></li></ul>`;

describe("parseMoviePage", () => {
  it("月・日ごとに、記事のある作品だけを読む", () => {
    expect(parseMoviePage(html, 2026)).toEqual([
      { title: "バイオハザード", release: "2026-10-09", country: "アメリカ合衆国" },
      { title: "汝、星のごとく", release: "2026-10-09", country: "日本" },
      { title: "ゴジラ-0.0", release: "2026-11-03", country: "日本" },
    ]);
  });
});
