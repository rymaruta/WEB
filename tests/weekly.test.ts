import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { isWeeklyKey, pickWeekly, recentWeeks, weekKey, weekLabel, weekRange } = await import("@/lib/weekly");

describe("weekKey / weekRange", () => {
  it("日本時間の月曜はじまりで週を数える", () => {
    // 2026-10-05（月）0時 JST は 10/4 15:00 UTC
    expect(weekKey(new Date("2026-10-04T15:00:00Z"))).toBe("2026-W41");
    expect(weekKey(new Date("2026-10-04T14:59:00Z"))).toBe("2026-W40");
    const r = weekRange("2026-W41")!;
    expect(r.start.toISOString()).toBe("2026-10-04T15:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-11T15:00:00.000Z");
  });
  it("年をまたぐ週と、ない週", () => {
    expect(weekKey(new Date("2027-01-01T03:00:00Z"))).toBe("2026-W53");
    expect(weekRange("2027-W53")).toBeNull();
    expect(weekRange("2026-10")).toBeNull();
  });
  it("表示と公開の範囲", () => {
    expect(weekLabel("2026-W41")).toBe("10月5日〜10月11日");
    const now = new Date("2026-10-07T00:00:00Z");
    expect(isWeeklyKey("2026-W41", now)).toBe(true);
    expect(isWeeklyKey("2026-W42", now)).toBe(false);
    expect(isWeeklyKey("2026-W39", now)).toBe(false);
    expect(recentWeeks(5, now)).toEqual(["2026-W41", "2026-W40"]);
  });
});

describe("pickWeekly", () => {
  it("報じた媒体の多い順に、同じジャンルは3本まで", () => {
    const c = (id: number, genreSlug: string, publisherCount: number) => ({ id, genreSlug, publisherCount, score: 0 });
    const r = pickWeekly([c(1, "sports", 9), c(2, "sports", 8), c(3, "sports", 7), c(4, "sports", 6), c(5, "domestic", 5)], 4);
    expect(r.map((x) => x.id)).toEqual([1, 2, 3, 5]);
  });
});
