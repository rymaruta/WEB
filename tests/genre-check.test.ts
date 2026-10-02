import { describe, expect, it, vi } from "vitest";

const executeRaw = vi.fn(async () => 0);
vi.mock("@/lib/db", () => ({
  prisma: {
    genre: { findMany: async () => [{ id: 1, slug: "business" }, { id: 2, slug: "entertainment" }, { id: 3, slug: "products" }] },
    topic: {
      findMany: async () => [
        // 2つの報道機関が報じた話題
        { id: 10, genreId: 1, articles: [{ publisher: "A新聞" }, { publisher: "B通信" }] },
        // 1つの媒体だけが載せた話題（占い・企業の発表など）
        { id: 11, genreId: 3, articles: [{ publisher: "Cニュース" }] },
      ],
    },
    $executeRaw: (...args: unknown[]) => executeRaw(...(args as [])),
  },
}));

const { GenreCheckSchema, pickKeeper, saveGenreChecks } = await import("@/lib/topics/genre-check");

describe("saveGenreChecks", () => {
  it("ジャンルを付け直し、報道のない告知だけを一覧から外す", async () => {
    const r = await saveGenreChecks([
      { id: 10, genre: "entertainment", notNews: true },
      { id: 11, genre: null, notNews: true },
      { id: 99, genre: "business", notNews: false },
    ]);
    // 2つ以上の報道機関が報じた話題（10）は「告知」と判定されても外さない。知らない話題（99）は無視する
    expect(r).toEqual({ saved: 2, moved: 1, hidden: 1, merged: 0 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("結果がなければ何もしない", async () => {
    executeRaw.mockClear();
    expect(await saveGenreChecks([])).toEqual({ saved: 0, moved: 0, hidden: 0, merged: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe("GenreCheckSchema", () => {
  it("サイトにないジャンルは受け付けない", () => {
    expect(GenreCheckSchema.safeParse({ results: [{ id: 1, genre: "politics", notNews: false }] }).success).toBe(false);
    expect(GenreCheckSchema.safeParse({ results: [{ id: 1, genre: null, notNews: false }] }).success).toBe(true);
  });
});

describe("pickKeeper", () => {
  const t = (id: number, publisherCount: number, ai: boolean) => ({ id, publisherCount, aiGeneratedAt: ai ? new Date() : null });
  it("AI まとめ記事があるほうを残す", () => {
    expect(pickKeeper(t(1, 5, false), t(2, 2, true))[0].id).toBe(2);
  });
  it("どちらも同じなら、報じた媒体の多いほう、次に先にできたほうを残す", () => {
    expect(pickKeeper(t(1, 2, false), t(2, 4, false))[0].id).toBe(2);
    expect(pickKeeper(t(5, 3, true), t(3, 3, true))[0].id).toBe(3);
  });
});
