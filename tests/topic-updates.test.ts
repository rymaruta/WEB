import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { buildUpdates, deltaUpdate, officialLag, reportDays } from "@/lib/topics/updates";
import { citedCounts, pointStatus, splitPoints } from "@/lib/ai/point-status";

const at = (s: string) => new Date(`${s}+09:00`);
const art = (id: number, publisher: string, when: string, title: string, kind = "NEWS") => ({ id, publisher, publishedAt: at(when), title, kind });

describe("reportDays（報道の動き）", () => {
  it("2日目以降を日ごとにまとめ、新しく報じた媒体とその日の最新の見出しを出す", () => {
    const days = reportDays([
      art(1, "A新聞", "2026-10-01T09:00:00", "市が新庁舎を発表"),
      art(2, "B通信", "2026-10-01T10:00:00", "新庁舎の計画"),
      art(3, "A新聞", "2026-10-02T08:00:00", "新庁舎、設計者が決定"),
      art(4, "C放送", "2026-10-02T12:00:00", "新庁舎の設計者に〇〇氏"),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ day: "2026-10-02", newOutlets: ["C放送"], headline: { articleId: 4, publisher: "C放送" } });
  });
  it("転載・企業の発表は数えない", () => {
    expect(reportDays([art(1, "PR TIMES", "2026-10-01T09:00:00", "発表", "PRESS"), art(2, "ライブドアニュース", "2026-10-02T09:00:00", "x")])).toEqual([]);
  });
});

describe("officialLag（公式の発表と最初の報道）", () => {
  it("発表から最初の報道までの分", () => {
    expect(officialLag([art(1, "国土交通省", "2026-10-01T14:00:00", "発表", "PRESS"), art(2, "A新聞", "2026-10-01T14:45:00", "報道")])).toEqual({
      publisher: "国土交通省",
      minutes: 45,
      before: false,
    });
  });
  it("発表より先に報道があれば before", () => {
    expect(officialLag([art(1, "国土交通省", "2026-10-01T14:00:00", "発表", "PRESS"), art(2, "A新聞", "2026-10-01T07:00:00", "報道")])).toMatchObject({ minutes: 420, before: true });
  });
  it("発表がなければ null", () => {
    expect(officialLag([art(2, "A新聞", "2026-10-01T07:00:00", "報道")])).toBeNull();
  });
});

describe("deltaUpdate（続報で分かったこと）", () => {
  const sources = [
    { position: 1, articleId: 10, publisher: "A新聞" },
    { position: 2, articleId: 11, publisher: "B通信" },
  ];
  it("出典の番号を記事へのリンクにする", () => {
    const u = deltaUpdate({
      topicId: 5,
      analyzedAt: at("2026-10-02T10:00:00"),
      sources,
      delta: { before: "前", now: { text: "工事が始まった", sources: [2] }, newFacts: [{ text: "完成は2030年", sources: [1, 2] }] },
    });
    expect(u?.now).toEqual({ text: "工事が始まった", links: [{ articleId: 11, publisher: "B通信" }] });
    expect(u?.facts[0].links).toHaveLength(2);
  });
  it("出典を追えない文は出さない。何も残らなければ null", () => {
    expect(deltaUpdate({ topicId: 5, analyzedAt: new Date(), sources, delta: { now: { text: "x", sources: [9] }, newFacts: [] } })).toBeNull();
    expect(deltaUpdate({ topicId: 5, analyzedAt: new Date(), sources, delta: null })).toBeNull();
  });
});

describe("buildUpdates", () => {
  it("報道の動き・公式の発表・続報を新しい順に並べる", () => {
    const u = buildUpdates(
      [
        art(1, "A新聞", "2026-10-01T09:00:00", "第一報"),
        art(2, "国土交通省", "2026-10-01T15:00:00", "発表", "PRESS"),
        art(3, "B通信", "2026-10-02T09:00:00", "続報"),
      ],
      [{ topicId: 1, analyzedAt: at("2026-10-03T09:00:00"), sources: [{ position: 1, articleId: 3, publisher: "B通信" }], delta: { now: { text: "今", sources: [1] }, newFacts: [] } }],
    );
    expect(u.map((x) => x.kind)).toEqual(["facts", "reports", "official"]);
  });
});

describe("要点の確認状況", () => {
  const sources = [
    { id: 1, publisher: "A新聞", kind: "NEWS" },
    { id: 2, publisher: "B通信", kind: "NEWS" },
    { id: 3, publisher: "国土交通省", kind: "PRESS" },
    { id: 4, publisher: "ライブドアニュース", kind: "NEWS" },
  ];
  const ids = [1, 2, 3, 4];
  it("公式発表・複数媒体・1媒体を出典から分ける（転載は独立した報道に数えない）", () => {
    expect(pointStatus([1, 2], ids, sources)?.status).toBe("multi");
    expect(pointStatus([1, 3], ids, sources)?.status).toBe("official");
    expect(pointStatus([1, 4], ids, sources)?.status).toBe("single");
    expect(pointStatus([9], ids, sources)).toBeNull();
  });
  it("共通の要点と、1媒体だけの要点を媒体ごとに分ける", () => {
    const s = splitPoints(
      [
        { text: "共通", sources: [1, 2] },
        { text: "A だけ1", sources: [1] },
        { text: "A だけ2", sources: [1] },
      ],
      ids,
      sources,
    );
    expect(s.common.map((c) => c.text)).toEqual(["共通"]);
    expect(s.only).toEqual([{ publisher: "A新聞", texts: ["A だけ1", "A だけ2"] }]);
  });
  it("媒体数は報道機関だけで数え、公式発表は別に示す", () => {
    expect(citedCounts(ids, sources)).toEqual({ news: 3, official: true });
  });
});

describe("latestUpdateText", () => {
  it("いちばん新しい動きを1文にする", async () => {
    const { latestUpdateText } = await import("@/lib/topics/updates");
    const d = new Date();
    expect(latestUpdateText([{ kind: "official", at: d, articleId: 1, publisher: "国土交通省", government: true, title: "発表" }], (p) => p)?.text).toBe("国土交通省が発表：発表");
    expect(latestUpdateText([], (p) => p)).toBeNull();
  });
});
