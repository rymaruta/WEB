import { describe, expect, it } from "vitest";
import { checkMerge, keyTerms, sharedTerms } from "@/lib/topics/merge-check";

const at = (h: number) => new Date(Date.UTC(2026, 9, 2, h));

describe("checkMerge", () => {
  it("同じ人の同じ出来事はまとめてよい（短い語が長い語に含まれる場合も共通）", () => {
    expect(sharedTerms("久保が結婚", "サッカー久保建英と電撃婚")).toContain("久保");
    expect(checkMerge({ title: "久保建英と福原遥が結婚", firstSeenAt: at(1) }, { title: "福原遥が電撃婚", firstSeenAt: at(5) }).ok).toBe(true);
  });

  it("共通の固有の語がなければまとめない（「発表」「速報」などは数えない）", () => {
    expect(keyTerms("【速報】新商品を発表")).toEqual(new Set(["新商品"]));
    expect(checkMerge({ title: "日銀が利上げを発表", firstSeenAt: at(1) }, { title: "トヨタが新型車を発表", firstSeenAt: at(2) })).toEqual({
      ok: false,
      reason: "見出しに共通の固有の語がない",
    });
  });

  it("一般の語（不正アクセス・サービスなど）だけが共通なら、別の会社の出来事をまとめない", () => {
    expect(
      checkMerge(
        { title: "佐川急便の荷物追跡サービスに不正アクセス 利用を一部制限", firstSeenAt: at(1) },
        { title: "ヤマト運輸、「クロネコ代金後払いサービス」への不正アクセスで続報 利用者に", firstSeenAt: at(2) },
      ).ok,
    ).toBe(false);
  });

  it("「立花氏」と「立花孝志被告」は同じ人として比べる", () => {
    expect(sharedTerms("Ｎ党立花氏襲撃、男認める", "立花孝志被告が約１１か月ぶりに表舞台で肉声")).toContain("立花");
  });

  it("時期が離れすぎていればまとめない", () => {
    const r = checkMerge({ title: "台風10号が上陸", firstSeenAt: at(0) }, { title: "台風10号の被害", firstSeenAt: new Date(at(0).getTime() + 100 * 3_600_000) });
    expect(r.ok).toBe(false);
  });
});

describe("1字の名字", () => {
  const at = new Date("2026-10-02T10:00:00+09:00");
  it("「簗農水相」と「簗和生農相」は同じ人としてまとめてよい", () => {
    expect(
      checkMerge(
        { title: "簗和生農相、予算カット発言を認める 辞任は否定 自民内には支援しなかったことへの", firstSeenAt: at },
        { title: "泉健太氏「しつこい押し問答は野党の評価を落とす」 簗農水相報道めぐる持論が物議.", firstSeenAt: at },
      ).ok,
    ).toBe(true);
    expect(sharedTerms("国交省が農相報道調査 簗氏「回答せず」繰り返し", "簗和生農水大臣、再び予算発言の説明回避")).toContain("簗");
  });
  it("役職・敬称のない語とは結び付けない（「林農相」と「林業」）", () => {
    expect(checkMerge({ title: "林農相が会見", firstSeenAt: at }, { title: "林業の担い手不足が深刻に", firstSeenAt: at }).ok).toBe(false);
  });
});
