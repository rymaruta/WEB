import { describe, expect, it } from "vitest";
import { bigWord, hotReason, isHot } from "@/lib/stories/hot";

const now = new Date("2026-10-02T13:00:00Z").getTime();
const ago = (min: number) => new Date(now - min * 60_000);

describe("isHot", () => {
  it("1時間以内に4媒体がそろった出来事は速報の候補", () => {
    expect(isHot({ publisherCount: 4, firstSeenAt: ago(40), lastSeenAt: ago(5) }, now)).toBe(true);
  });
  it("4媒体でも、そろうまで1時間以上かかった出来事は候補にしない", () => {
    expect(isHot({ publisherCount: 4, firstSeenAt: ago(150), lastSeenAt: ago(10) }, now)).toBe(false);
  });
  it("3時間以内に5媒体なら候補", () => {
    expect(isHot({ publisherCount: 5, firstSeenAt: ago(170), lastSeenAt: ago(1) }, now)).toBe(true);
  });
  it("大きな出来事の言葉があれば、1媒体でも候補", () => {
    expect(hotReason({ title: "久保建英、女優・福原遥と結婚を発表", publisherCount: 1, firstSeenAt: ago(3) }, now)).toBe("「結婚」");
    expect(isHot({ title: "人気俳優が死去 58歳", publisherCount: 1, firstSeenAt: ago(3) }, now)).toBe(true);
  });
  it("言葉が入っていても、大きな出来事でない言い方は除く", () => {
    expect(bigWord("秋の結婚式場ランキング")).toBeNull();
    expect(bigWord("優勝候補の3チームを比較")).toBeNull();
    expect(isHot({ title: "新しいスマホが発売", publisherCount: 1, firstSeenAt: ago(3) }, now)).toBe(false);
  });
  it("3時間を過ぎた出来事・3媒体以下は候補にしない", () => {
    expect(isHot({ publisherCount: 9, firstSeenAt: ago(200) }, now)).toBe(false);
    expect(isHot({ publisherCount: 3, firstSeenAt: ago(10) }, now)).toBe(false);
  });
});
