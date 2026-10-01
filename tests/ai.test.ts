import { describe, expect, it } from "vitest";
import { readAiArticle } from "@/lib/ai/article";
import { buildPrompt, checkArticleFacts, sanitizeArticle } from "@/lib/ai/prompt";

const base = {
  title: " 見出し ",
  lead: "リード",
  points: [
    { text: "要点A", sources: [2, 1, 2] },
    { text: "範囲外だけの要点", sources: [9] },
  ],
  body: ["段落1", " "],
  sufficient: true,
};

describe("sanitizeArticle", () => {
  it("出典番号を資料の範囲に制限し、重複を除いて並べ替える", () => {
    const a = sanitizeArticle(base, 3)!;
    expect(a.title).toBe("見出し");
    expect(a.points).toEqual([{ text: "要点A", sources: [1, 2] }]);
    expect(a.body).toEqual(["段落1"]);
  });

  it("資料不足と判断された記事や、根拠のある要点がない記事は採用しない", () => {
    expect(sanitizeArticle({ ...base, sufficient: false }, 3)).toBeNull();
    expect(sanitizeArticle({ ...base, points: [{ text: "x", sources: [5] }] }, 3)).toBeNull();
  });
});

describe("buildPrompt", () => {
  it("資料に番号・媒体名・企業発表の区別を付ける", () => {
    const prompt = buildPrompt([
      { publisher: "A新聞", publishedAt: new Date("2026-09-30T03:00:00Z"), title: "t1", summary: null, kind: "NEWS" },
      { publisher: "B社", publishedAt: new Date("2026-09-30T04:00:00Z"), title: "t2", summary: "s2", kind: "PRESS" },
    ]);
    expect(prompt).toContain("[1] A新聞／2026/9/30 12:00");
    expect(prompt).toContain("要約: （なし）");
    expect(prompt).toContain("[2] B社（企業発表）");
  });
});

describe("readAiArticle", () => {
  const stored = {
    aiTitle: "見出し",
    aiLead: "リード",
    aiBody: "段落1\n\n段落2",
    aiPoints: [{ text: "要点", sources: [1] }],
    aiSources: [10, 11],
    aiModel: "m",
    aiGeneratedAt: new Date(),
  };

  it("保存形式から表示用に復元する", () => {
    const a = readAiArticle(stored)!;
    expect(a.body).toEqual(["段落1", "段落2"]);
    expect(a.sourceIds).toEqual([10, 11]);
  });

  it("未作成や壊れたデータは null", () => {
    expect(readAiArticle({ ...stored, aiTitle: null })).toBeNull();
    expect(readAiArticle({ ...stored, aiPoints: "broken" })).toBeNull();
  });
});

describe("checkArticleFacts", () => {
  const src = [
    { publisher: "A新聞", publishedAt: new Date("2026-09-30T03:00:00Z"), title: "米Micron、売上高4.8倍", summary: "純利益は11.8倍に" },
    { publisher: "B通信", publishedAt: new Date("2026-09-30T04:00:00Z"), title: "Micronが過去最高益", summary: "AI向けメモリが好調" },
  ];
  const art = {
    title: "米Micronが過去最高の決算",
    lead: "売上高は前年同期比4.8倍。",
    points: [{ text: "純利益は11.8倍", sources: [1] }],
    body: ["A新聞によると、AI向けメモリが好調だった。", "株価は20%上昇した。"],
    sufficient: true,
  };
  it("資料にある語だけなら採用し、資料にない数字を含む段落は落とす", () => {
    const r = checkArticleFacts(art, src);
    expect(r.article?.body).toEqual(["A新聞によると、AI向けメモリが好調だった。"]);
    expect(r.missing).toContain("20");
  });
  it("見出し・要点に資料にない数字があれば採用しない", () => {
    expect(checkArticleFacts({ ...art, title: "米Micron、売上高5倍" }, src).article).toBeNull();
    expect(checkArticleFacts({ ...art, points: [{ text: "純利益は11.8倍", sources: [2] }] }, src).article).toBeNull();
  });
  it("煽り表現があれば採用しない", () => {
    expect(checkArticleFacts({ ...art, title: "【衝撃】米Micronが過去最高の決算" }, src).article).toBeNull();
  });
});
