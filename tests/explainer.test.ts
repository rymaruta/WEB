import { describe, expect, it } from "vitest";
import { checkExplainer, detectCharset, htmlToText, isAllowedUrl, normalizeForMatch, readExplainer, type Explainer } from "@/lib/ai/explainer";

const page1 = htmlToText(`<html><head><script>var x="三天時代";</script><style>p{}</style></head><body>
<h1>東京リベンジャーズ 三天戦争編</h1>
<p>原作は和久井健による漫画で、「週刊少年マガジン」（講談社）で連載された。</p>
<p>TVアニメ第4期。3つのチームが覇権を争う&quot;三天時代&quot;となった世界で、最後のリベンジが始まる。</p>
</body></html>`);
const page2 = "放送局：MBS、TBS、CBC、BS-TBS、AT-X　2026年10月2日（金）より放送開始";

const base: Explainer = {
  subject: "三天時代",
  items: [
    { text: "漫画『東京卍リベンジャーズ』が原作で、作者は和久井健さん。「週刊少年マガジン」で連載された。", refs: [1] },
    { text: "テレビアニメの第4期にあたり、3つのチームが覇権を争う「三天時代」を描く。", refs: [1] },
    { text: "10月2日からMBS・TBSなどで放送が始まった。", refs: [2] },
  ],
  refs: [
    { url: "https://anime.example.jp/program/1", title: "作品情報", quote: "TVアニメ第4期。3つのチームが覇権を争う\"三天時代\"となった世界" },
    { url: "https://www.example.co.jp/a", title: "放送情報", quote: "MBS、TBS、CBC、BS-TBS、AT-X　2026年10月2日" },
  ],
};

describe("htmlToText", () => {
  it("スクリプト・スタイルを除き、文字参照を戻す", () => {
    expect(page1).not.toContain("var x");
    expect(page1).toContain('"三天時代"');
  });
});

describe("normalizeForMatch", () => {
  it("全角・半角、空白、引用符の違いを無視する", () => {
    expect(normalizeForMatch("ＴＶアニメ 第４期 “三天時代”")).toBe(normalizeForMatch('TVアニメ第4期"三天時代"'));
  });
});

describe("isAllowedUrl", () => {
  it("https の公開のホストだけ", () => {
    expect(isAllowedUrl("https://anime.eiga.com/program/112304/")).toBe(true);
    expect(isAllowedUrl("http://anime.eiga.com/")).toBe(false);
    expect(isAllowedUrl("https://127.0.0.1/")).toBe(false);
    expect(isAllowedUrl("https://localhost/")).toBe(false);
    expect(isAllowedUrl("https://db.internal/")).toBe(false);
    expect(isAllowedUrl("https://user:pw@example.com/")).toBe(false);
    expect(isAllowedUrl("not a url")).toBe(false);
  });
});

describe("detectCharset", () => {
  it("ヘッダー → meta の順に読む", () => {
    expect(detectCharset("text/html; charset=Shift_JIS", new Uint8Array())).toBe("shift_jis");
    expect(detectCharset("text/html", new TextEncoder().encode('<meta charset="EUC-JP">'))).toBe("euc-jp");
    expect(detectCharset(null, new Uint8Array())).toBe("utf-8");
  });
});

describe("checkExplainer", () => {
  it("抜き書きがページにあり、文の語が抜き書きにある文だけを残す", () => {
    const r = checkExplainer(base, [page1, page2]);
    // 1文目は「東京卍リベンジャーズ」「週刊少年マガジン」「和久井健」が出典1の抜き書きにないため落ちる
    expect(r.explainer?.items.map((i) => i.text)).toEqual([base.items[1].text, base.items[2].text]);
    expect(r.problems.some((p) => p.includes("抜き書きにない語"))).toBe(true);
    expect(r.explainer?.refs.map((x) => x.host)).toEqual(["anime.example.jp", "example.co.jp"]);
  });

  it("抜き書きがページにない出典は使わない（作り話の出典を載せない）", () => {
    const r = checkExplainer(base, [page1, "まったく別のページ"]);
    expect(r.explainer).toBeNull();
    expect(r.problems).toContain("出典2: 抜き書きがページにない");
  });

  it("ページを取得できない出典は使わない", () => {
    const r = checkExplainer(base, [null, page2]);
    expect(r.explainer).toBeNull();
    expect(r.problems).toContain("出典1: ページを取得できない");
  });

  it("出典の文章をそのまま写した文は落とす", () => {
    const long = "3つのチームが覇権を争う三天時代となった世界で最後のリベンジが始まる物語でありシリーズの第4期となる";
    const e: Explainer = {
      ...base,
      items: [{ text: long, refs: [1] }, base.items[2], base.items[1]],
      refs: [{ ...base.refs[0], quote: long }, base.refs[1]],
    };
    const r = checkExplainer(e, [long, page2]);
    expect(r.problems.some((p) => p.includes("そのまま写している"))).toBe(true);
  });

  it("作り方についての文・煽り表現は落とす", () => {
    const e: Explainer = { ...base, items: [{ text: "記事では触れられていないが、衝撃の最終章が始まる。", refs: [1] }, base.items[1], base.items[2]] };
    const r = checkExplainer(e, [page1, page2]);
    expect(r.explainer?.items).toHaveLength(2);
    expect(r.problems.some((p) => p.includes("読者向けでない"))).toBe(true);
  });

  it("使った出典だけを残し、番号を振り直す", () => {
    const e: Explainer = {
      ...base,
      items: [base.items[2], { text: "放送はMBS・TBSのほか、CBCやAT-Xでも行われる。", refs: [3] }],
      refs: [base.refs[0], { ...base.refs[0], url: "https://unused.example.jp/" }, base.refs[1]],
    };
    const r = checkExplainer({ ...e, subject: "MBS", items: [{ ...base.items[2], refs: [3] }, e.items[1]] }, [page1, page1, page2]);
    expect(r.explainer?.refs).toHaveLength(1);
    expect(r.explainer?.items.every((i) => i.refs.join() === "1")).toBe(true);
  });
});

describe("readExplainer", () => {
  it("不正な形は null", () => {
    expect(readExplainer(null)).toBeNull();
    expect(readExplainer({ subject: "x", items: [], refs: [] })).toBeNull();
    expect(readExplainer({ subject: "x", items: [{ text: "a", refs: [1] }], refs: [{ url: "https://a.jp", title: "t", host: "a.jp", quote: "q" }] })?.subject).toBe("x");
  });
});

describe("htmlToText（文字参照）", () => {
  it("よく使われる名前付きの文字参照を戻す", () => {
    expect(htmlToText("<p>特&emsp;集&hellip;&yen;100&#x41;&#65;</p>")).toBe("特 集…¥100AA");
  });
});

describe("checkExplainer（同じページの複数の抜き書き）", () => {
  it("出典欄では同じ URL を1つにまとめる", () => {
    const e: Explainer = {
      ...base,
      items: [base.items[1], { text: "原作は和久井健さんの漫画で、「週刊少年マガジン」に連載された。", refs: [2] }],
      refs: [base.refs[0], { ...base.refs[0], quote: "原作は和久井健による漫画で、「週刊少年マガジン」（講談社）で連載された。" }],
    };
    const r = checkExplainer(e, [page1, page1]);
    expect(r.explainer?.refs).toHaveLength(1);
    expect(r.explainer?.items.map((i) => i.refs.join())).toEqual(["1", "1"]);
  });

  it("記事の見出しにある語は抜き書きになくてよい", () => {
    const e: Explainer = { ...base, subject: "東京リベンジャーズ", items: [{ text: "「東京リベンジャーズ」のテレビアニメ第4期にあたる。", refs: [1] }, base.items[2]] };
    expect(checkExplainer(e, [page1, page2]).explainer).toBeNull();
    expect(checkExplainer(e, [page1, page2], "「東京リベンジャーズ 三天戦争編」放送開始").explainer?.items).toHaveLength(2);
  });
});

describe("checkExplainer（定義の文）", () => {
  it("subject そのものを説明した文がなければ載せない", () => {
    const e: Explainer = { ...base, subject: "三天戦争", items: [base.items[2], { text: "放送はMBS・TBSなどで、毎週金曜に始まる。", refs: [2] }] };
    const r = checkExplainer(e, [page1, page2]);
    expect(r.explainer).toBeNull();
    expect(r.problems).toContain("「三天戦争」そのものを説明した文がない");
  });

  it("定義の文を先頭にする", () => {
    const e: Explainer = { ...base, subject: "三天時代", items: [base.items[2], base.items[1]] };
    expect(checkExplainer(e, [page1, page2]).explainer?.items[0].text).toBe(base.items[1].text);
  });
});
