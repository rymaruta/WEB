import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { buildNewsMap, topicEntities, type MapTopic } from "@/lib/news-map";

const t = (id: number, day: number, companies: string[], extra: Partial<MapTopic> = {}): MapTopic => ({
  id,
  title: `話題${id}`,
  aiTitle: null,
  aiCompanies: companies,
  aiGameTitle: null,
  aiGameKey: null,
  aiAnimeTitle: null,
  firstSeenAt: new Date(Date.UTC(2026, 9, day)),
  ...extra,
});

describe("ニュース相関図", () => {
  it("同じ話題に出た企業を、一緒に出た数の多い順に。中心の企業は入れない", () => {
    const links = buildNewsMap({ kind: "company", key: "A社" }, [t(1, 1, ["A社", "B社"]), t(2, 2, ["A社", "B社", "C社"]), t(3, 3, ["A社", "C社"]), t(4, 4, ["A社", "B社"])]);
    expect(links.map((l) => [l.entity.name, l.count])).toEqual([
      ["B社", 3],
      ["C社", 2],
    ]);
    // 根拠の話題は新しい順
    expect(links[0].topics.map((x) => x.id)).toEqual([4, 2, 1]);
  });
  it("作品と国も、決まった情報から結ぶ（見出しの国名は言葉の一覧で）", () => {
    const e = topicEntities(t(1, 1, ["任天堂"], { aiTitle: "任天堂、米国で新作ゲームを発表", aiGameTitle: "新作X", aiGameKey: "シンサクX" }));
    expect(e.map((x) => x.kind)).toEqual(["company", "game", "country"]);
    expect(e.find((x) => x.kind === "country")?.href).toMatch(/^\/country\//);
  });
  it("同じ話題に同じものが2回出ても1回と数える", () => {
    const links = buildNewsMap({ kind: "company", key: "A社" }, [t(1, 1, ["A社", "B社", "B社"])]);
    expect(links[0].count).toBe(1);
  });
});
