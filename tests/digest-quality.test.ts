import { describe, expect, it } from "vitest";
import { editionQualityProblems } from "@/lib/digest/check";
import { independentOutlets, independentOutletsOf, isPortal, outletKey } from "@/lib/digest/outlets";
import { selectForEdition, type Candidate } from "@/lib/digest/select";
import { SLOTS } from "@/lib/digest/slots";

const cand = (o: Partial<Candidate> = {}): Candidate => ({
  id: Math.random().toString(36).slice(2),
  kind: "NEW",
  status: "APPROVED",
  category: "SOCIETY",
  threadId: null,
  assessment: { impact: 2, longevity: 2, publicInterest: 2, gossip: false, promotional: false } as Candidate["assessment"],
  publisherCount: 4,
  hasPrimary: false,
  confidence: 0.9,
  clicks: 0,
  ...o,
});

describe("独立した媒体の数", () => {
  it("同じ媒体の別名は1つに数える", () => {
    expect(outletKey("朝日新聞デジタル")).toBe(outletKey("朝日新聞"));
    expect(outletKey("nikkansports.com")).toBe(outletKey("日刊スポーツ"));
    expect(independentOutlets(["朝日新聞", "朝日新聞デジタル", "毎日新聞"])).toBe(2);
  });

  it("転載のポータルは数えない", () => {
    expect(isPortal("Yahoo!ニュース")).toBe(true);
    expect(isPortal("news.livedoor.com")).toBe(true);
    expect(isPortal("読売新聞オンライン")).toBe(false);
    expect(independentOutlets(["Yahoo!ニュース", "ライブドアニュース", "共同通信"])).toBe(1);
  });

  it("媒体がない・すべて転載でも 1", () => {
    expect(independentOutlets([])).toBe(1);
    expect(independentOutlets(["Yahoo!ニュース"])).toBe(1);
  });
});

describe("載らなかった理由の記録", () => {
  it("落ちた候補ごとに理由を残す", () => {
    const sports = [1, 2, 3].map((i) => cand({ id: `s${i}`, category: "SPORTS", publisherCount: 8 - i }));
    const others = [cand({ id: "e", category: "ECONOMY" }), cand({ id: "w", category: "WORLD" })];
    const old = cand({ id: "old", category: "TECH", threadId: "t-old" });
    const r = selectForEdition([...sports, ...others, old], SLOTS.LUNCH, new Set(["t-old"]));
    const reason = new Map(r.notes.rejected.map((x) => [x.id, x.reason]));
    expect(reason.get("old")).toBe("前の配信回に載った出来事");
    expect(reason.get("s2")).toMatch(/上限/);
    // 選ばれたものは記録に入らない
    for (const m of r.main) expect(reason.has(m.id)).toBe(false);
  });

  it("基準点以上の候補は、ふだんの上限（芸能・スポーツは合わせて1本）で理由を付ける", () => {
    const cs = [
      cand({ id: "sp1", category: "SPORTS", publisherCount: 9 }),
      cand({ id: "en1", category: "ENTERTAINMENT", publisherCount: 8 }),
      cand({ id: "so1", category: "SOCIETY" }),
      cand({ id: "ec1", category: "ECONOMY" }),
    ];
    const r = selectForEdition(cs, SLOTS.MORNING, new Set());
    expect(r.notes.rejected.find((x) => x.id === "en1")?.reason).toBe("芸能・スポーツの合計の上限");
  });

  it("人の確認が要る候補は、おまかせ投稿では理由つきで外す", () => {
    const r = selectForEdition([cand({ id: "rv", status: "REVIEW_REQUIRED" })], SLOTS.LUNCH, new Set(), { verifiedOnly: true });
    expect(r.notes.rejected[0]).toMatchObject({ id: "rv", reason: "人の確認が必要（おまかせ投稿では使わない）" });
  });
});

describe("投稿前の品質チェック", () => {
  const item = (category: string, threadId: string | null = null) => ({ category, threadId, headline: ["見出し"], sources: 2 });

  it("全部が同じ分野でも止めない（必ず3本を優先し、注意として記録する）", () => {
    const r0 = editionQualityProblems([item("SPORTS"), item("SPORTS"), item("SPORTS")]);
    expect(r0.blocking).toEqual([]);
    expect(r0.warnings).toContain("3本とも同じ分野（SPORTS）");
  });

  it("同じ出来事の重複・見出しや出典の欠けを止める", () => {
    const r = editionQualityProblems([item("SOCIETY", "t1"), item("ECONOMY", "t1"), { category: "WORLD", threadId: null, headline: [""], sources: 0 }]);
    expect(r.blocking).toEqual(["同じ出来事が2本以上", "3本目に見出しがない", "3本目に出典がない"]);
  });

  it("芸能・スポーツが過半で硬いニュースがなければ注意を残す（止めない）", () => {
    const r = editionQualityProblems([item("SPORTS"), item("ENTERTAINMENT"), item("TECH")]);
    expect(r.blocking).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it("分野が分かれていれば問題なし", () => {
    expect(editionQualityProblems([item("SOCIETY"), item("ECONOMY"), item("SPORTS")])).toEqual({ blocking: [], warnings: [] });
  });
});

describe("独立した媒体の数（見出しも見る）", () => {
  it("同じ見出しの記事は、媒体が違っても転載として1つに数える", () => {
    const t = "38歳レヴァンドフスキがハット達成！ ポーランド、ルーマニアに6発で大勝";
    expect(independentOutletsOf([{ publisher: "サッカーキング", title: t }, { publisher: "マイナビニュース", title: t }])).toBe(1);
  });
  it("ポータルと同じ見出しでも、元の媒体は数える", () => {
    const t = "広島、4選手と来季契約結ばず";
    expect(independentOutletsOf([{ publisher: "ライブドアニュース", title: t }, { publisher: "Full-Count", title: t }, { publisher: "時事ドットコム", title: "広島が4選手に通告" }])).toBe(2);
  });
});
