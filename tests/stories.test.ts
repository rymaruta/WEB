import { describe, expect, it } from "vitest";
import { isSameEvent } from "@/lib/stories/dedup";
import type { StoryAnalysis, StoryMaterial } from "@/lib/stories/schema";
import { textWidth } from "@/lib/stories/text";
import { extractFacts, factInSources, longestCommonRun, verifyAnalysis } from "@/lib/stories/verify";

const materials: StoryMaterial[] = [
  {
    position: 1,
    publisher: "マイナビニュース",
    publishedAt: new Date("2026-09-30T08:11:00Z"),
    title: "Google、新AIモデル「Gemini 4 Argon」発表。コーディングや長時間タスクを強化",
    summary: "Googleは9月30日、新たなフロンティアAIモデル「Gemini 4 Argon」を発表した。",
    isPrimary: false,
  },
  {
    position: 2,
    publisher: "Impress Watch",
    publishedAt: new Date("2026-09-30T08:36:00Z"),
    title: "コーディングも法務もGPT-6 Astra超え。Google「Gemini 4 Argon」",
    summary: "新しいAIモデルは1回の処理で数十万トークンを生成でき、ソフトウェア開発や法務・財務といった長く複雑な業務を扱うことを想定して構築された。",
    isPrimary: false,
  },
];

const base: StoryAnalysis = {
  sufficient: true,
  category: "TECH",
  cardType: "NORMAL",
  importance: "normal",
  riskFlags: [],
  headline: ["Google、新AIモデル", "「Gemini 4 Argon」発表"],
  summary: "Googleが新しいAIモデルを発表した。",
  points: [
    { text: "複数工程の長時間作業を重視", sources: [1] },
    { text: "開発・法務・財務の業務を想定", sources: [2] },
    { text: "1回で数十万トークンを生成", sources: [2, 9] },
  ],
  entities: { people: [], orgs: ["Google"], places: [], eventType: "製品発表", eventDate: "2026-09-30" },
  eventTime: "9月30日",
  conflicts: [],
  shortTitle: "Google 新AIモデル発表",
  keyword: "Gemini 4",
  why: { text: "開発や法務など長く複雑な業務が対象", sources: [2] },
  assessment: { impact: 2, longevity: 2, publicInterest: 1, actionable: false, gossip: false, promotional: false },
  confidence: 0.9,
};

describe("textWidth", () => {
  it("全角は1、半角は0.5", () => {
    expect(textWidth("あいう")).toBe(3);
    expect(textWidth("Google")).toBe(3);
    expect(textWidth("【テック】Googleが新AIモデルを発表")).toBe(17);
  });
});

describe("verifyAnalysis", () => {
  it("正しい出力は配信の候補（PENDING）。範囲外の出典番号は取り除く", () => {
    const r = verifyAnalysis(base, materials);
    expect(r.notes).toEqual([]);
    expect(r.status).toBe("PENDING");
    expect(r.cleaned.points[2].sources).toEqual([2]);
  });

  it("資料にない数字は見つけて要確認にする", () => {
    const r = verifyAnalysis({ ...base, points: [...base.points.slice(0, 2), { text: "処理速度は3倍に向上", sources: [2] }] }, materials);
    expect(r.status).toBe("REVIEW_REQUIRED");
    expect(r.missingFacts).toContain("3");
  });

  it("資料にない固有名詞（英字）も見つける", () => {
    const r = verifyAnalysis({ ...base, summary: "GoogleとOpenAIが新モデルを発表した。" }, materials);
    expect(r.missingFacts).toContain("OpenAI");
  });

  it("文字数の上限を超えたら要確認", () => {
    const r = verifyAnalysis({ ...base, headline: ["Googleが新しいAIモデルを発表しました"] }, materials);
    expect(r.status).toBe("REVIEW_REQUIRED");
    expect(r.notes.some((n) => n.includes("見出し1行目"))).toBe(true);
  });

  it("一覧用の見出し・キーワードの文字数も確かめる", () => {
    const r = verifyAnalysis({ ...base, shortTitle: "Googleが新しいAIモデルを発表した", keyword: "グーグルの新しいモデル" }, materials);
    expect(r.notes.some((n) => n.includes("一覧用の見出し"))).toBe(true);
    expect(r.notes.some((n) => n.includes("キーワード"))).toBe(true);
  });

  it("「なぜ重要」は出典の番号が必要。資料にない数字があれば要確認", () => {
    expect(verifyAnalysis({ ...base, why: { text: "業務の対象が広い", sources: [] } }, materials).notes.join()).toContain("「なぜ重要」に出典");
    const r = verifyAnalysis({ ...base, why: { text: "市場規模は5兆円に達する", sources: [2] } }, materials);
    expect(r.missingFacts).toContain("5");
  });

  it("「なぜ重要」がなくてもよい（null）", () => {
    expect(verifyAnalysis({ ...base, why: null }, materials).status).toBe("PENDING");
  });

  it("煽り表現は要確認", () => {
    const r = verifyAnalysis({ ...base, shortTitle: "衝撃の新AIモデル" }, materials);
    expect(r.status).toBe("REVIEW_REQUIRED");
  });

  it("慎重に扱う分野は必ず要確認", () => {
    const r = verifyAnalysis({ ...base, riskFlags: ["ACCIDENT"] }, materials);
    expect(r.status).toBe("REVIEW_REQUIRED");
    expect(r.notes.join()).toContain("事故");
  });

  it("確からしさが低い・食い違いがあると要確認", () => {
    expect(verifyAnalysis({ ...base, confidence: 0.5 }, materials).status).toBe("REVIEW_REQUIRED");
    expect(verifyAnalysis({ ...base, conflicts: [{ about: "発表日", detail: "9/30と10/1" }] }, materials).status).toBe("REVIEW_REQUIRED");
  });

  it("長い社名が資料と一致しても、写しすぎとはしない", () => {
    const mats = [{ ...materials[0], summary: "ソニー・インタラクティブエンタテインメントは10月1日、提供内容を公開した。" }];
    const r = verifyAnalysis({ ...base, summary: "ソニー・インタラクティブエンタテインメントが内容を公開した。" }, mats);
    expect(r.notes.some((n) => n.includes("一致"))).toBe(false);
  });

  it("要約が資料を長く写していれば要確認", () => {
    const long = "新しいAIモデルは1回の処理で数十万トークンを生成でき、ソフトウェア開発や法務・財務といった長く複雑な業務を扱う";
    const r = verifyAnalysis({ ...base, summary: long }, materials);
    expect(r.notes.some((n) => n.includes("一致"))).toBe(true);
  });

  it("AI が資料不足と判断したら自動で除外", () => {
    expect(verifyAnalysis({ ...base, sufficient: false }, materials).status).toBe("REJECTED_AUTO");
  });
});

describe("事実の照合の部品", () => {
  it("数字・カギかっこ・英字の語を抜き出す", () => {
    expect(extractFacts("「声」もパブリシティー権の対象、Gemini 4 Argonは30日")).toEqual(expect.arrayContaining(["30", "声", "Gemini 4 Argon"]));
  });
  it("数字は桁違いを誤って一致としない", () => {
    expect(factInSources("1", "10月1日")).toBe(true);
    expect(factInSources("3", "30日")).toBe(false);
    expect(factInSources("4,300", "4300m急降下")).toBe(true);
    expect(factInSources("4300", "4,300m急降下")).toBe(true);
    // 「F1 25」の25を、空白を消した「F125」として誤判定しない
    expect(factInSources("25", "PS5用「F1 25」などをラインナップ")).toBe(true);
  });
  it("連続一致の長さ", () => {
    expect(longestCommonRun("あいうえおか", "xxいうえおyy")).toBe(4);
  });
});

describe("isSameEvent（重複判定）", () => {
  const t = new Date("2026-09-30T10:00:00Z");
  it("見出しの書き方が違っても、同じ出来事（旅客機の件）は1件と判定する", () => {
    const a = { people: ["ネタニヤフ"], orgs: ["フライドバイ"], places: ["サウジアラビア", "テルアビブ"], eventType: "緊急着陸", eventDate: "2026-09-30" };
    const b = { people: [], orgs: ["フライドバイ航空"], places: ["ドバイ", "テルアビブ"], eventType: "旅客機の緊急着陸", eventDate: "不明" };
    expect(isSameEvent(a, b, t, new Date(t.getTime() + 6 * 3_600_000))).toBe(true);
  });
  it("同じ会社でも別の出来事は別と判定する", () => {
    const a = { people: [], orgs: ["Google"], places: [], eventType: "製品発表", eventDate: "2026-09-30" };
    const b = { people: [], orgs: ["Google"], places: [], eventType: "訴訟", eventDate: "2026-09-29" };
    expect(isSameEvent(a, b, t, t)).toBe(false);
  });
  it("48時間より離れていれば別", () => {
    const a = { people: ["岸田"], orgs: ["自民党"], places: [], eventType: "会見", eventDate: "不明" };
    expect(isSameEvent(a, a, t, new Date(t.getTime() + 49 * 3_600_000))).toBe(false);
  });
});
