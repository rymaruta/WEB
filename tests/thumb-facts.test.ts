import { describe, expect, it } from "vitest";
import { readNumber, readScore, readThumbFact } from "@/lib/thumb-facts";

describe("サムネイルに描く事実（見出しから読む）", () => {
  it("試合のスコアは、主語のチームの得点を先に読む", () => {
    expect(readScore("ソフトバンクが9回の山本祐大3ランで逆転勝ち、ロッテに4－3")).toEqual({ kind: "score", a: "ソフトバンク", b: "ロッテ", scoreA: 4, scoreB: 3 });
    expect(readScore("ベルギーがトルコに3-0で完勝")).toMatchObject({ a: "ベルギー", b: "トルコ", scoreA: 3, scoreB: 0 });
  });

  it("チームが2つ読めない・日付の数字はスコアにしない", () => {
    expect(readScore("大谷翔平が50号本塁打")).toBeNull();
    expect(readScore("巨人、10-1から2連敗")).toBeNull();
    expect(readScore("ロッテと楽天が10-5の日程を発表 10月5日")).toMatchObject({ scoreA: 10, scoreB: 5 });
  });

  it("主役の数字と、何の数字か・変化の語を読む", () => {
    expect(readNumber("9月の米雇用は2.9万人増、失業率は4.2%に悪化")).toEqual({ kind: "number", label: "9月の米雇用", value: "2.9万人", trend: "増" });
    expect(readNumber("「大倉忠義という切り札を使い切った」鳥貴族、400円台突破の再値上げで「客離れ」の懸念")).toMatchObject({ label: "鳥貴族", value: "400円", trend: "突破" });
    expect(readNumber("タイムズカーで約660万件の個人情報流出")).toMatchObject({ value: "660万件" });
  });

  it("日付・回・年齢だけの見出しは読まない", () => {
    expect(readNumber("10月1日から新制度")).toBeNull();
    expect(readNumber("やばい後輩 第152回")).toBeNull();
    expect(readNumber("久保建英は25歳、福原遥は28歳")).toBeNull();
  });

  it("ジャンルで読み方を分ける（エンタメ・アニメ・ゲームは描かない）", () => {
    expect(readThumbFact("ソフトバンクがロッテに4－3", "sports")?.kind).toBe("score");
    expect(readThumbFact("失業率は4.2%に悪化", "business")?.kind).toBe("number");
    expect(readThumbFact("興行収入100億円突破", "entertainment")).toBeNull();
  });
});
