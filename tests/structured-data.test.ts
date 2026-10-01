import { describe, expect, it } from "vitest";
import { newsArticleJsonLd, serializeJsonLd } from "@/lib/structured-data";

const article = {
  title: "見出し",
  lead: "リード",
  body: ["本文"],
  points: [],
  sourceIds: [1],
  model: "claude-code",
  generatedAt: new Date("2026-10-01T00:00:00Z"),
};

describe("構造化データ", () => {
  it("AI まとめ記事を NewsArticle として表し、材料の記事を isBasedOn に入れる", () => {
    const d = newsArticleJsonLd(12, article, [{ url: "https://example.com/a", publisher: "A新聞" }]);
    expect(d["@type"]).toBe("NewsArticle");
    expect(d.headline).toBe("見出し");
    expect(d.datePublished).toBe("2026-10-01T00:00:00.000Z");
    expect(d.url).toMatch(/\/topic\/12$/);
    expect(d.isBasedOn[0]).toMatchObject({ url: "https://example.com/a", publisher: { name: "A新聞" } });
  });
  it("</script> で HTML が壊れないように < を逃がす", () => {
    expect(serializeJsonLd({ t: "</script><b>" })).toBe('{"t":"\\u003c/script>\\u003cb>"}');
  });
});

describe("サイト・パンくずの構造化データ", () => {
  it("パンくずは順番どおりの位置と絶対 URL を持つ", async () => {
    const { breadcrumbJsonLd, siteJsonLd } = await import("@/lib/structured-data");
    const b = breadcrumbJsonLd([{ name: "トップ", path: "/" }, { name: "経済", path: "/genre/business" }]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toMatch(/\/genre\/business$/);
    const s = siteJsonLd();
    expect((s["@graph"][1] as { sameAs: string[] }).sameAs).toContain("https://x.com/ZenbuNavi");
  });
});
