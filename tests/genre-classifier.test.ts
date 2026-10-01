import { describe, expect, it } from "vitest";
import { classifierText, isTrainingFeed, MIXED_FEEDS, predictGenre, reclassify, trainGenreModel } from "@/lib/topics/genre-classifier";

const docs = [
  ...["日本代表がPK戦で勝利", "森保監督が試合後に会見", "J1リーグ首位攻防戦", "大谷翔平が本塁打", "阪神が延長戦で引き分け", "サッカー日本代表メンバー発表", "巨人の投手が好投", "W杯予選で日本代表が勝利"].map((t) => ({ text: t, genre: "sports" })),
  ...["新型iPhoneを発表", "Windowsの更新でバグ", "生成AIの新モデル公開", "iPhoneの新機能を解説", "AIで業務を効率化", "Windows向けの新しいAI機能", "スマホの新モデル発表", "AIチップの性能を比較"].map((t) => ({ text: t, genre: "tech" })),
];

describe("genre classifier", () => {
  const model = trainGenreModel(docs, 1);

  it("見出しからジャンルを当てる", () => {
    expect(predictGenre(model, "日本代表の監督が会見")?.slug).toBe("sports");
    expect(predictGenre(model, "新しいAIモデルを発表")?.slug).toBe("tech");
  });

  it("混ざったフィードの記事だけを、自信があるときに判定し直す", () => {
    const mynavi = "https://news.mynavi.jp/rss/index";
    expect(MIXED_FEEDS.has(mynavi)).toBe(true);
    expect(reclassify(model, mynavi, "tech", "日本代表がPK戦で勝利 森保監督", { minProb: 0.6 })).toBe("sports");
    // 特化したフィードは変えない
    expect(reclassify(model, "https://web.gekisaka.jp/feed", "sports", "新型iPhoneを発表", { minProb: 0.6 })).toBe("sports");
    // 学習した語がほとんどなければ変えない
    expect(reclassify(model, mynavi, "tech", "ほげ", { minProb: 0.6 })).toBe("tech");
  });

  it("正答率を確かめたジャンル（いまはスポーツ）にだけ移す", () => {
    const tbs = "https://newsdig.tbs.co.jp/list/feed/rss";
    expect(reclassify(model, tbs, "domestic", "新型iPhoneを発表 AIの新機能", { minProb: 0.6 })).toBe("domestic");
    expect(reclassify(model, tbs, "domestic", "日本代表がPK戦で勝利 森保監督", { minProb: 0.6 })).toBe("sports");
  });

  it("国内は、混ざったフィードでも教材にする", () => {
    expect(isTrainingFeed("https://mainichi.jp/rss/etc/mainichi-flash.rss", "domestic")).toBe(true);
    expect(isTrainingFeed("https://news.mynavi.jp/rss/index", "tech")).toBe(false);
    expect(isTrainingFeed("https://web.gekisaka.jp/feed", "sports")).toBe(true);
  });

  it("要約は冒頭だけを使う", () => {
    expect(classifierText("見出し", "あ".repeat(300)).length).toBe(4 + 120);
  });
});
