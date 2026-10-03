import { describe, expect, it } from "vitest";
import { coverageTimes, elapsedLabel, firstReporter, numberDiffs } from "@/lib/coverage";

const at = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+09:00`);
const a = (id: number, publisher: string, hhmm: string, title: string, kind = "NEWS") => ({ id, publisher, publishedAt: at(hhmm), title, kind });

describe("coverageTimes", () => {
  it("報道機関ごとの最初の記事に、最初の報道からの経過を付ける（企業の発表・SNS は除く）", () => {
    const t = coverageTimes([
      a(1, "PR TIMES", "09:00", "発表", "PRESS"),
      a(2, "A新聞", "09:10", "市が新庁舎の建設を発表"),
      a(3, "B通信", "09:25", "新庁舎、2030年に完成へ"),
      a(4, "A新聞", "09:40", "続報"),
    ]);
    expect(t.get(2)).toEqual({ minutes: 0, first: true });
    expect(t.get(3)).toEqual({ minutes: 15, first: false });
    expect(t.has(1)).toBe(false);
    expect(t.has(4)).toBe(false);
  });
  it("1社だけなら比べない", () => {
    expect(coverageTimes([a(1, "A新聞", "09:00", "x")]).size).toBe(0);
  });
});

describe("転載の扱い", () => {
  it("先に出た記事と同じ見出しの記事は、別の媒体でも転載として比べない", () => {
    const t = coverageTimes([
      a(1, "サッカーキング", "07:31", "38歳レヴァンドフスキがハット達成！ ポーランド、ルーマニアに6発で大勝"),
      a(2, "マイナビニュース", "07:31", "38歳レヴァンドフスキがハット達成！ ポーランド、ルーマニアに6発で大勝"),
    ]);
    // 独立した報道は1つだけなので、比べない
    expect(t.size).toBe(0);
  });
  it("転載を配信する媒体（ライブドアニュース）は、媒体名で除く", () => {
    const t = coverageTimes([
      a(1, "ライブドアニュース", "06:00", "見出しA"),
      a(2, "A新聞", "06:10", "見出しB"),
      a(3, "B通信", "06:20", "見出しC"),
    ]);
    expect(t.has(1)).toBe(false);
    expect(t.get(2)).toEqual({ minutes: 0, first: true });
  });
  it("最初に報じた媒体は、転載と同じ見出しの記事を除いて数える", () => {
    const arts = [
      a(1, "マイナビニュース", "08:00", "共同通信の記事"),
      a(2, "共同通信", "08:00", "共同通信の記事"),
      a(3, "A新聞", "08:30", "A新聞の記事"),
    ];
    // 同じ見出しは1つの報道。独立した報道は2つなので、3媒体以上の条件を満たさない
    expect(firstReporter(arts)).toBeNull();
    expect(firstReporter([...arts, a(4, "B通信", "08:40", "B通信の記事")])).toBe("マイナビニュース");
  });
});

describe("elapsedLabel", () => {
  it("分・時間・日で表す", () => {
    expect(elapsedLabel(5)).toBe("+5分");
    expect(elapsedLabel(150)).toBe("+3時間");
    expect(elapsedLabel(3000)).toBe("+2日");
  });
});

describe("numberDiffs", () => {
  it("同じ言葉・同じ単位で値が違うときだけ拾う", () => {
    const d = numberDiffs([
      a(1, "A新聞", "09:00", "住宅火災で死者3人、けが人5人"),
      a(2, "B通信", "09:10", "住宅火災、死者4人に"),
      a(3, "C放送", "09:20", "火災で死者3人"),
      a(4, "D新聞", "09:30", "男性2人を逮捕"),
    ]);
    expect(d).toEqual([
      {
        label: "死者◯人",
        values: [
          { value: "3人", publishers: ["A新聞", "C放送"] },
          { value: "4人", publishers: ["B通信"] },
        ],
      },
    ]);
  });
  it("値がそろっていれば何も出さない", () => {
    expect(numberDiffs([a(1, "A", "09:00", "死者3人"), a(2, "B", "09:10", "死者3人")])).toEqual([]);
  });
});

describe("firstReporter", () => {
  it("3媒体以上が報じた出来事で、最初に報じた報道機関", () => {
    const list = [a(1, "B通信", "09:10", "見出しB"), a(2, "A新聞", "09:00", "見出しA"), a(3, "C放送", "09:20", "見出しC")];
    expect(firstReporter(list)).toBe("A新聞");
    expect(firstReporter(list.slice(0, 2))).toBeNull();
  });
});

describe("転載する媒体", () => {
  it("速さの比較と速報ランキングから除く", () => {
    const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m));
    const arts = [
      { id: 1, publisher: "news.livedoor.com", publishedAt: at(0), title: "見出し1", kind: "NEWS" },
      { id: 2, publisher: "a.jp", publishedAt: at(5), title: "見出し2", kind: "NEWS" },
      { id: 3, publisher: "b.jp", publishedAt: at(9), title: "見出し3", kind: "NEWS" },
      { id: 4, publisher: "c.jp", publishedAt: at(12), title: "見出し4", kind: "NEWS" },
    ];
    expect(firstReporter(arts)).toBe("a.jp");
    expect(coverageTimes(arts).get(2)).toEqual({ minutes: 0, first: true });
    expect(coverageTimes(arts).has(1)).toBe(false);
  });
});

describe("報道の広がり", async () => {
  const { spreadCurve, reportsWithin, minutesToReach } = await import("@/lib/coverage");
  const at = (min: number) => new Date(Date.UTC(2026, 9, 3, 0, min));
  const a = (id: number, publisher: string, min: number, title = `見出し${id}`) => ({ id, publisher, publishedAt: at(min), title, kind: "NEWS" });

  it("独立した媒体ごとに最初の報道を数え、経過と累積を返す（転載・同じ媒体の2本目は数えない）", () => {
    const pts = spreadCurve([a(1, "共同通信", 0), a(2, "NHK", 20), a(3, "NHK", 30), a(4, "ライブドアニュース", 25), a(5, "朝日新聞", 90), a(6, "毎日新聞", 95, "見出し5")]);
    expect(pts.map((p) => [p.publisher, p.minutes, p.count])).toEqual([
      ["共同通信", 0, 1],
      ["NHK", 20, 2],
      ["朝日新聞", 90, 3],
    ]);
    expect(reportsWithin(pts, 60)).toBe(2);
    expect(minutesToReach(pts, 3)).toBe(90);
    expect(minutesToReach(pts, 5)).toBeNull();
  });

  it("3媒体未満は広がりとして出さない", () => {
    expect(spreadCurve([a(1, "共同通信", 0), a(2, "NHK", 5)])).toEqual([]);
  });
});
