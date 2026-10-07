import { describe, expect, it } from "vitest";
import { clearFameCache, famousSubject, fameTerms } from "@/lib/fame";

const human = { P31: [{ mainsnak: { datavalue: { value: { id: "Q5" } } } }] };
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
      return json({ entities: { Q615: { sitelinks: Object.fromEntries(Array.from({ length: 120 }, (_, i) => [`x${i}wiki`, {}])), claims: human }, Q2: { sitelinks: { jawiki: {} }, claims: human } } });
    };
    expect((await famousSubject("メッシが引退", fetchImpl as typeof fetch))?.title).toBe("リオネル・メッシ");
    expect(await famousSubject("山田が優勝", fetchImpl as typeof fetch)).toBeNull();
    expect(await famousSubject("無名選手が優勝", fetchImpl as typeof fetch)).toBeNull();
  });

  it("地名・一般的な言葉は、閲覧数が多くても主役にしない（雑誌のコラムや調査が速報の候補になっていた）", async () => {
    clearFameCache();
    const many = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`x${i}wiki`, {}]));
    const fetchImpl = async (url: string) => {
      if (url.includes("ja.wikipedia.org"))
        return json({
          query: {
            pages: [
              { title: "女性", pageprops: { wikibase_item: "Q467" }, pageviews: { a: 90_000 } },
              { title: "中国", pageprops: { wikibase_item: "Q148" }, pageviews: { a: 300_000 } },
              { title: "トヨタ自動車", pageprops: { wikibase_item: "Q53268" }, pageviews: { a: 40_000 } },
            ],
          },
        });
      return json({
        entities: {
          Q467: { sitelinks: many, claims: { P31: [{ mainsnak: { datavalue: { value: { id: "Q48264" } } } }] } },
          Q148: { sitelinks: many, claims: { P571: [{}], P625: [{}] } },
          Q53268: { sitelinks: many, claims: { P159: [{}], P452: [{}] } },
        },
      });
    };
    expect(await famousSubject("20〜50代の女性1000名に聞いた調査", fetchImpl as typeof fetch)).toBeNull();
    expect(await famousSubject("中国の価値観のデータ", fetchImpl as typeof fetch)).toBeNull();
    expect((await famousSubject("トヨタ自動車が新型車", fetchImpl as typeof fetch))?.title).toBe("トヨタ自動車");
  });
});
