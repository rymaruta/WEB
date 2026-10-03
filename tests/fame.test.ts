import { describe, expect, it } from "vitest";
import { clearFameCache, famousSubject, fameTerms } from "@/lib/fame";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("知名度（ウィキペディア）", () => {
  it("見出しから人名・固有名詞を取り出す", () => {
    expect(fameTerms("久保建英選手と福原遥さんが結婚")).toEqual(expect.arrayContaining(["久保建英", "福原遥"]));
  });

  it("閲覧数か言語版の数が基準を超えれば有名。曖昧さ回避は使わない。転送は使う", async () => {
    clearFameCache();
    const fetchImpl = async (url: string) => {
      if (url.includes("ja.wikipedia.org"))
        return json({
          query: {
            redirects: [{ from: "メッシ", to: "リオネル・メッシ" }],
            pages: [
              { title: "リオネル・メッシ", pageprops: { wikibase_item: "Q615" }, pageviews: { a: 20_000, b: 20_000 } },
              { title: "山田", pageprops: { wikibase_item: "Q1", disambiguation: "" }, pageviews: { a: 99_999 } },
              { title: "無名選手", pageprops: { wikibase_item: "Q2" }, pageviews: { a: 100 } },
            ],
          },
        });
      return json({ entities: { Q615: { sitelinks: Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`x${i}wiki`, {}])) }, Q2: { sitelinks: { jawiki: {} } } } });
    };
    expect((await famousSubject("メッシが引退", fetchImpl as typeof fetch))?.title).toBe("リオネル・メッシ");
    expect(await famousSubject("山田が優勝", fetchImpl as typeof fetch)).toBeNull();
    expect(await famousSubject("無名選手が優勝", fetchImpl as typeof fetch)).toBeNull();
  });
});
