import { describe, expect, it, vi } from "vitest";
import gold from "./fixtures/genre-gold.json";
import { judgeGenre } from "@/lib/topics/genre-rules";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { decideTopicGenre, OVERRIDE_AI_CONFIDENCE, TOPIC_MIN_CONFIDENCE } = await import("@/lib/topics/genre-apply");

/** 本番と同じく、信頼度が足りない判定では今のジャンルのままにする */
const applied = (r: Row) => {
  const j = judgeGenre(r.title, r.summary, r.current, r.publisher || undefined);
  return j.moved && j.confidence >= TOPIC_MIN_CONFIDENCE ? j.genre : r.current;
};

type Row = { id: number; title: string; summary: string | null; publisher: string; current: string; gold: string };
const rows = gold as Row[];

describe("judgeGenre（検証データ）", () => {
  it("人が付けた正解との一致率が 93% 以上（今の分類は 72.7%）", () => {
    const hit = rows.filter((r) => applied(r) === r.gold).length;
    // 2026-10-02 時点: 220件中 206件（93.6%）。下がったら規則の変更を見直す
    expect(hit / rows.length).toBeGreaterThanOrEqual(0.93);
  });

  it("今のジャンルが正しい話題を、ほとんど動かさない（誤って動かすのは 3% まで）", () => {
    const ok = rows.filter((r) => r.current === r.gold);
    const broken = ok.filter((r) => applied(r) !== r.gold).length;
    expect(broken / ok.length).toBeLessThanOrEqual(0.03);
  });
});

describe("judgeGenre（指摘された例）", () => {
  it("経済誌が報じた芸能人の話題は entertainment", () => {
    const j = judgeGenre("人気女優が結婚を発表 所属事務所がコメント", "俳優の〇〇さんが結婚したことを所属事務所が発表した。", "business", "東洋経済オンライン");
    expect(j.genre).toBe("entertainment");
    expect(j.moved).toBe(true);
  });

  it("キャラクターグッズの発売は products（tech・game にしない）", () => {
    expect(judgeGenre("サンリオの限定グッズを配布 ローソンでキャンペーン", null, "tech").genre).toBe("products");
  });

  it("スポーツ選手の結婚は entertainment", () => {
    expect(judgeGenre("久保建英選手と福原遥さんが結婚を発表", null, "sports").genre).toBe("entertainment");
  });

  it("手がかりがなければ配信元のジャンルのまま、信頼度 0", () => {
    const j = judgeGenre("きょうのできごと", null, "domestic");
    expect(j).toMatchObject({ genre: "domestic", moved: false });
  });

  it("判定の根拠（効いた語）を返す", () => {
    expect(judgeGenre("人気女優が結婚を発表", null, "business").reason).toContain("女優");
  });
});

describe("decideTopicGenre", () => {
  const base = { id: 1, summary: null, publisher: null, note: null };

  it("AI がまだ見ていない話題は、ルールのジャンルにして記録を残す", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表 所属事務所がコメント", genreSlug: "business", aiGenreSlug: null });
    expect(d.genre).toBe("entertainment");
    expect(d.recheck).toBe(false);
    expect(d.note).toMatch(/^rule entertainment conf=/);
  });

  it("AI の判定とルールが一致すれば、そのまま", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表", genreSlug: "entertainment", aiGenreSlug: "entertainment" });
    expect(d).toMatchObject({ genre: "entertainment", recheck: false });
  });

  it("ルールが AI と強く食い違えば、AI にもう一度だけ見てもらう", () => {
    const title = "人気女優が結婚を発表 所属事務所がコメント";
    const j = judgeGenre(title, null, "business");
    expect(j.confidence).toBeGreaterThanOrEqual(OVERRIDE_AI_CONFIDENCE);
    const d = decideTopicGenre({ ...base, title, genreSlug: "business", aiGenreSlug: "business" });
    expect(d).toMatchObject({ genre: "entertainment", recheck: true });
    expect(d.note).toMatch(/^recheck ai=business /);
  });

  it("見直し待ちの間は動かさない", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表", genreSlug: "entertainment", aiGenreSlug: null, note: "recheck ai=business entertainment conf=0.8" });
    expect(d).toEqual({ genre: "entertainment", note: null, recheck: false });
  });

  it("見直した AI の判定（ai-final）は、ルールで変えない（行ったり来たりしない）", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表 所属事務所がコメント", genreSlug: "business", aiGenreSlug: "business", note: "ai-final business conf=0.9 企業の経営の話題" });
    expect(d).toEqual({ genre: "business", note: null, recheck: false });
  });

  it("AI の記録は、ルールの記録で上書きしない", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表", genreSlug: "entertainment", aiGenreSlug: "entertainment", note: "ai entertainment conf=0.9 俳優の結婚" });
    expect(d.note).toBeNull();
  });
});
