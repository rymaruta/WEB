import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { archiveMonths, dayLabel, dayRange, isArchiveMonth, isDailyKey, monthRange, recentDays, shiftDay } = await import("@/lib/archive");

const now = new Date("2026-10-02T15:30:00Z"); // 日本時間 10月3日 0:30

describe("日付ページ", () => {
  it("集め始めた日から今日（日本時間）まで", () => {
    expect(isDailyKey("2026-10-03", now)).toBe(true);
    expect(isDailyKey("2026-10-04", now)).toBe(false);
    expect(isDailyKey("2026-09-29", now)).toBe(false);
    expect(isDailyKey("2026-02-30", now)).toBe(false);
    expect(isDailyKey("abc", now)).toBe(false);
  });
  it("日本時間の1日の範囲と、前後の日", () => {
    expect(dayRange("2026-10-02").start.toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(recentDays(10, now)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30"]);
    expect(dayLabel("2026-10-02")).toBe("10月2日（金）");
  });
});

describe("月間まとめ", () => {
  it("集め始めた月から今月まで", () => {
    expect(isArchiveMonth("2026-10", now)).toBe(true);
    expect(isArchiveMonth("2026-09", now)).toBe(false);
    expect(isArchiveMonth("2026-11", now)).toBe(false);
    expect(archiveMonths(new Date("2027-01-10T00:00:00Z"))).toEqual(["2027-01", "2026-12", "2026-11", "2026-10"]);
    expect(monthRange("2026-12").end.toISOString()).toBe("2026-12-31T15:00:00.000Z");
  });
});
