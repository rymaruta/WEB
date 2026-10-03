import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { announcementStats, median, raceStats, recentJstDays, volumeStats, type OutletTopic } from "@/lib/outlet";

const at = (s: string) => new Date(`2026-10-02T${s}:00+09:00`);
const art = (id: number, publisher: string, hhmm: string, title: string, kind = "NEWS") => ({ id, publisher, publishedAt: at(hhmm), title, kind });

describe("median", () => {
  it("中央値（偶数個は真ん中2つの平均）。空は null", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(3);
    expect(median([])).toBeNull();
  });
});

describe("volumeStats", () => {
  it("日本時間の日付・時間帯・ジャンルで数える", () => {
    const now = new Date("2026-10-03T12:00:00+09:00");
    const v = volumeStats(
      [
        { publishedAt: new Date("2026-10-03T08:30:00+09:00"), genre: "国内" },
        { publishedAt: new Date("2026-10-03T00:10:00+09:00"), genre: "国内" },
        { publishedAt: new Date("2026-10-02T23:50:00+09:00"), genre: "経済" },
      ],
      3,
      now,
    );
    expect(recentJstDays(3, now)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(v.daily.map((d) => d.count)).toEqual([0, 1, 2]);
    expect(v.hourly[0]).toBe(1);
    expect(v.hourly[8]).toBe(1);
    expect(v.hourly[23]).toBe(1);
    expect(v.genres).toEqual([
      { name: "国内", count: 2 },
      { name: "経済", count: 1 },
    ]);
  });
});

describe("raceStats", () => {
  const topic = (id: number, articles: OutletTopic["articles"]): OutletTopic => ({ id, title: `話題${id}`, publisherCount: 3, articles });
  it("3社以上が報じた出来事で、何番目・何分後に報じたかを数える", () => {
    const r = raceStats("B通信", [
      topic(1, [art(1, "A新聞", "09:00", "市が新庁舎を発表"), art(2, "B通信", "09:20", "新庁舎、2030年完成へ"), art(3, "C放送", "09:40", "新庁舎の計画")]),
      topic(2, [art(4, "B通信", "10:00", "台風が接近"), art(5, "A新聞", "10:05", "台風、九州に接近"), art(6, "C放送", "11:30", "台風の進路")]),
      // 2社だけの出来事は比べない
      topic(3, [art(7, "B通信", "12:00", "x"), art(8, "A新聞", "12:10", "y")]),
    ])!;
    expect(r.compared).toBe(2);
    expect(r.firsts).toBe(1);
    expect(r.within1h).toBe(2);
    expect(r.medianBehind).toBe(20);
    expect(r.major.map((t) => [t.id, t.rank, t.minutes])).toEqual([
      [2, 1, 0],
      [1, 2, 20],
    ]);
  });
  it("転載を配信する媒体は比べない", () => {
    expect(raceStats("ライブドアニュース", [])).toBeNull();
  });
});

describe("announcementStats", () => {
  const ann = (id: number, hhmm: string, topic: OutletTopic | null) => ({ id, title: `発表${id}`, url: `https://example.go.jp/${id}`, publishedAt: at(hhmm), topic });
  it("報じた報道機関の数と、発表から最初の報道までの時間。発表より前の報道は分けて数える", () => {
    const s = announcementStats([
      ann(1, "10:00", { id: 11, title: "t", publisherCount: 2, articles: [art(1, "国土交通省", "10:00", "発表", "PRESS"), art(2, "A新聞", "10:30", "a"), art(3, "B通信", "11:00", "b")] }),
      ann(2, "14:00", { id: 12, title: "t", publisherCount: 1, articles: [art(4, "C放送", "08:00", "c")] }),
      ann(3, "15:00", null),
      // 時刻のない発表（0時0分）は時間を測らない
      ann(4, "00:00", { id: 14, title: "t", publisherCount: 1, articles: [art(5, "A新聞", "09:00", "d")] }),
    ]);
    expect(s.total).toBe(4);
    expect(s.reported).toBe(3);
    expect(s.before).toBe(1);
    expect(s.medianLag).toBe(30);
    expect(s.top[0]).toMatchObject({ id: 1, reporters: 2, lag: 30, topicId: 11 });
    expect(s.recent.map((r) => r.id)).toEqual([3, 2, 1, 4]);
  });
});
