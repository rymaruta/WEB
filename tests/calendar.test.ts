import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { jstDate, monthsBetween, sortCalendar, toIcs } = await import("@/lib/calendar");
type Item = Parameters<typeof sortCalendar>[0][number];

const item = (date: string, category: Item["category"], title: string, extra: Partial<Item> = {}): Item => ({
  date,
  category,
  title,
  note: null,
  href: null,
  external: false,
  ...extra,
});

describe("jstDate / monthsBetween", () => {
  it("日本時間の日付と、またがる月", () => {
    expect(jstDate(new Date("2026-09-30T16:00:00Z"))).toBe("2026-10-01");
    expect(jstDate(new Date("2026-10-01T00:00:00Z"), 45)).toBe("2026-11-15");
    expect(monthsBetween("2026-11-20", "2027-01-05")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});

describe("sortCalendar", () => {
  it("日まで決まった、範囲内のものだけを日付順・分野順に並べる", () => {
    const r = sortCalendar(
      [
        item("2026-10-05", "game", "B"),
        item("2026-10", "anime", "月だけ"),
        item("2026-10-05", "changes", "A"),
        item("2026-09-30", "movie", "範囲の前"),
        item("2026-10-03", "products", "C"),
      ],
      "2026-10-01",
      "2026-10-31",
    );
    expect(r.map((x) => x.title)).toEqual(["C", "A", "B"]);
  });
});

describe("toIcs", () => {
  const ics = toIcs(
    [
      item("2026-10-03", "game", "タイトル, その1; 続き", { note: "Switch 2・PS5", href: "/topic/5" }),
      item("2026-10-04", "game", "ストアの作品", { href: "https://store.example/x", external: true }),
    ],
    "https://zenbu-navi.com",
    "ぜんぶカレンダー",
    new Date("2026-10-02T00:00:00Z"),
  );
  it("終日の予定として書き、記号をエスケープする", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261003");
    expect(ics).toContain("DTEND;VALUE=DATE:20261004");
    expect(ics).toContain("SUMMARY:【ゲーム】タイトル\\, その1\\; 続き");
    expect(ics).toContain("URL:https://zenbu-navi.com/topic/5");
    expect(ics).toContain("URL:https://store.example/x");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
  it("1行は75バイトまでで折り返す", () => {
    const long = toIcs([item("2026-10-03", "anime", "あ".repeat(60))], "https://zenbu-navi.com", "x");
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n /g, "")).toContain(`SUMMARY:【アニメ】${"あ".repeat(60)}`);
  });
});
