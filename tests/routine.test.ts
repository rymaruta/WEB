import { describe, expect, it } from "vitest";
import { isRoutineTitle, isUnlistable, isWeakHeadline } from "@/lib/topics/routine";

describe("定型の記事", () => {
  it("占い・予告先発・公示・試合速報・セール情報は定型", () => {
    for (const t of [
      "【2026年10月3日の運勢】九星気学占い(総合運・恋愛運・金運・仕事運)",
      "２日の予告先発投手 プロ野球パ・リーグ",
      "セ・リーグ公示（２日） プロ野球",
      "阪神 vs 巨人 2026年10月1日のプロ野球速報",
      "【プロ野球試合開始前】ヤクルト vs 巨人（2026-10-02・明治神宮野球場）",
      "「ニーア オートマタ」60%オフで2,112円！ もうすぐ終了のセール情報まとめ【10月3日更新】",
      "【本日みつけたお買い得品】アーロンチェアが5万円以上安く！",
    ])
      expect(isRoutineTitle(t), t).toBe(true);
  });
  it("出来事の見出しは定型にしない", () => {
    for (const t of ["広島、小園海斗ら4選手と来季契約結ばず", "金融庁、プルデンシャル生命に業務停止命令へ", "日本ハムの北山、最多勝が決定的 プロ野球"])
      expect(isRoutineTitle(t), t).toBe(false);
  });
});

describe("弱い見出し", () => {
  it("語を並べただけの短い見出しは弱い", () => {
    expect(isWeakHeadline("プロ野球・ひとこと")).toBe(true);
    expect(isUnlistable("プロ野球・ひとこと")).toBe(true);
  });
  it("助詞・数字があれば何が起きたかが書かれているとみなす", () => {
    expect(isWeakHeadline("大谷翔平は選外")).toBe(false);
    expect(isWeakHeadline("WWDC2026開幕")).toBe(false);
    expect(isWeakHeadline("伊東四朗さんが引退")).toBe(false);
  });
  it("「・」のない短い見出しは出来事を表すので弱くない", () => {
    expect(isWeakHeadline("円安加速")).toBe(false);
  });
  it("長い見出しは弱くない", () => {
    expect(isWeakHeadline("レヴァンドフスキがハットトリック、ポーランドがルーマニアに大勝")).toBe(false);
  });
});
