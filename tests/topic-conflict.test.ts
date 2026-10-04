import { describe, expect, it } from "vitest";
import { titleConflict } from "@/lib/topics/conflict";

describe("同じ話題にまとめない組み合わせ", () => {
  it("名字が同じで名前が違う人の記事はまとめない", () => {
    const members = ["広島・小園海斗が家宅捜索", "小園海斗、疑惑を完全否定"];
    expect(titleConflict("DeNA戦力外の小園健太「チームのために」", members)).toBe(true);
    expect(titleConflict("小園海斗の処分、球団が検討", members)).toBe(false);
  });
  it("組織名や地名の言葉は人名とみなさない", () => {
    expect(titleConflict("日本銀行が利上げを決定", ["日本代表がW杯へ", "日本代表が合宿"])).toBe(false);
  });
  it("年代別の代表が違えばまとめない", () => {
    expect(titleConflict("U-23日本代表が決勝へ", ["U-21日本代表が準決勝で勝利"])).toBe(true);
    expect(titleConflict("U-21日本代表が決勝で韓国と対戦", ["U-21日本代表が準決勝で勝利"])).toBe(false);
  });
  it("男子と女子はまとめない", () => {
    expect(titleConflict("男子U-21代表の大岩監督「よく頑張った」", ["なでしこジャパンが決勝進出", "女子代表が準決勝で勝利"])).toBe(true);
  });
  it("食い違いがなければまとめてよい", () => {
    expect(titleConflict("新庁舎、2030年に完成へ", ["市が新庁舎の建設を発表"])).toBe(false);
  });
});
