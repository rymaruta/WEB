import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { filmKeys, isAnimeCandidate, sortAnime, verifyAnime } = await import("@/lib/anime");

describe("isAnimeCandidate", () => {
  it("始まる月・日がある放送・配信の記事を候補にする", () => {
    expect(isAnimeCandidate("大友克洋キャラデザの「幻魔大戦」BS12「日曜アニメ劇場」11月放送", "anime")).toBe(true);
    expect(isAnimeCandidate("TVアニメ「〇〇」10月5日より放送開始", "entertainment")).toBe(true);
  });
  it("見られるサービスの案内や、アニメ以外のエンタメ記事は候補にしない", () => {
    expect(isAnimeCandidate("アニメ「マロニエ王国の七人の騎士」の配信はどこで見れる？10月の放送日も紹介", "anime")).toBe(false);
    expect(isAnimeCandidate("ドラマ「〇〇」10月5日より放送開始", "entertainment")).toBe(false);
  });
});

describe("verifyAnime", () => {
  const src = "大友克洋キャラデザの「幻魔大戦」BS12「日曜アニメ劇場」11月放送";
  it("作品名と月が資料にあれば残す。放送局は資料になければ外す", () => {
    expect(verifyAnime({ title: "幻魔大戦", date: "2026-11", kind: "tv", channel: "BS12" }, src)).toEqual({
      title: "幻魔大戦",
      date: "2026-11",
      kind: "tv",
      channel: "BS12",
    });
    expect(verifyAnime({ title: "幻魔大戦", date: "2026-11", kind: "tv", channel: "TOKYO MX" }, src)?.channel).toBeNull();
  });
  it("資料にない作品名・日付は使わない", () => {
    expect(verifyAnime({ title: "攻殻機動隊", date: "2026-11", kind: "tv", channel: null }, src)).toBeNull();
    expect(verifyAnime({ title: "幻魔大戦", date: "2026-12", kind: "tv", channel: null }, src)).toBeNull();
  });
});

describe("sortAnime", () => {
  it("同じ作品・同じ種類は1件にし、日まで分かるものを優先して日付順に並べる", () => {
    const items = sortAnime([
      { topicId: 1, title: "作品A", date: "2026-10", kind: "tv", channel: "TOKYO MX" },
      { topicId: 2, title: "作品B", date: "2026-10-03", kind: "stream", channel: null },
      { topicId: 3, title: "作品A", date: "2026-10-10", kind: "tv", channel: null },
      { topicId: 4, title: "作品A", date: "2026-10-12", kind: "stream", channel: null },
    ]);
    expect(items.map((i) => [i.topicId, i.date, i.channel])).toEqual([
      [2, "2026-10-03", null],
      [3, "2026-10-10", "TOKYO MX"],
      [4, "2026-10-12", null],
    ]);
  });
});

describe("filmKeys", () => {
  it("題名全体と、最初の区切りまで（5字以上）で探す", () => {
    expect(filmKeys("ガールズ&パンツァー 最終章 第5話")).toEqual(["ガールズ&パンツァー最終章第5話", "ガールズ&パンツァー"]);
    expect(filmKeys("映画 ひつじのショーン かぼちゃ畑の怪物!")).toEqual(["映画ひつじのショーンかぼちゃ畑の怪物!"]);
    expect(filmKeys("鴉")).toEqual([]);
  });
});
