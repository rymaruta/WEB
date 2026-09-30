import { describe, expect, it } from "vitest";
import { readAiArticle } from "@/lib/ai/article";
import { buildPrompt, sanitizeArticle } from "@/lib/ai/prompt";

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
