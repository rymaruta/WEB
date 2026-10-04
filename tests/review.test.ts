import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { isReviewCurrent, reviewFlags } from "@/lib/review";

const base = {
  title: "新庁舎の建設を発表",
  aiTitle: "市が新庁舎の建設を発表",
  aiLead: "市は新庁舎を建てると発表した。",
  aiBody: "完成は2030年の予定。",
  aiPoints: [{ text: "a", sources: [1] }, { text: "b", sources: [1] }, { text: "c", sources: [2] }],
  aiGeneratedAt: new Date("2026-10-04T00:00:00Z"),
  lastSeenAt: new Date("2026-10-04T01:00:00Z"),
  articleTitles: ["市が新庁舎の建設を発表", "新庁舎、2030年完成へ"],
};

describe("点検の手がかり", () => {
  it("問題がなければ手がかりなし", () => {
    expect(reviewFlags(base)).toEqual([]);
  });
  it("古いおそれ・要点が少ない・読者向けでない文・事件の話題を見分ける", () => {
    const f = reviewFlags({
      ...base,
      title: "男を逮捕",
      lastSeenAt: new Date("2026-10-04T12:00:00Z"),
      aiPoints: [{ text: "a", sources: [1] }],
      aiBody: "資料には動機は書かれていない。",
    });
    expect(f).toEqual(["stale", "fewPoints", "metaText", "sensitive"]);
  });
  it("別の人の記事が混ざったおそれ", () => {
    expect(reviewFlags({ ...base, articleTitles: ["小園海斗が家宅捜索", "小園海斗、疑惑を否定", "小園健太が戦力外"] })).toContain("mixed");
  });
});

describe("人の確認が有効か", () => {
  const t = { reviewStatus: "ok", reviewedAt: new Date("2026-10-04T02:00:00Z"), aiGeneratedAt: new Date("2026-10-04T01:00:00Z") };
  it("確認の後に書き直していなければ有効", () => {
    expect(isReviewCurrent(t)).toBe(true);
  });
  it("確認の後に書き直したら無効、外した記事も無効", () => {
    expect(isReviewCurrent({ ...t, aiGeneratedAt: new Date("2026-10-04T03:00:00Z") })).toBe(false);
    expect(isReviewCurrent({ ...t, reviewStatus: "hold" })).toBe(false);
  });
});
