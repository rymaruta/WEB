import { describe, expect, it } from "vitest";
import { coverageTimes, elapsedLabel, firstReporter, numberDiffs } from "@/lib/coverage";

const at = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+09:00`);
const a = (id: number, publisher: string, hhmm: string, title: string, kind = "NEWS") => ({ id, publisher, publishedAt: at(hhmm), title, kind });

describe("coverageTimes", () => {
  it("報道機関ごとの最初の記事に、最初の報道からの経過を付ける（企業の発表・SNS は除く）", () => {
    const t = coverageTimes([
      a(1, "PR TIMES", "09:00", "発表", "PRESS"),
      a(2, "A新聞", "09:10", "見出し"),
      a(3, "B通信", "09:25", "見出し"),
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
    const list = [a(1, "B通信", "09:10", "x"), a(2, "A新聞", "09:00", "x"), a(3, "C放送", "09:20", "x")];
    expect(firstReporter(list)).toBe("A新聞");
    expect(firstReporter(list.slice(0, 2))).toBeNull();
  });
});
