import { describe, expect, it, vi } from "vitest";

const executeRaw = vi.fn(async () => 0);
vi.mock("@/lib/db", () => ({
  prisma: {
    genre: { findMany: async () => [{ id: 1, slug: "business" }, { id: 2, slug: "entertainment" }, { id: 3, slug: "products" }] },
    topic: {
      findMany: async () => [
        // 報道機関の記事がある話題
        { id: 10, genreId: 1, articles: [{ id: 100 }] },
        // 企業の発表だけの話題
        { id: 11, genreId: 3, articles: [] },
      ],
    },
    $executeRaw: (...args: unknown[]) => executeRaw(...(args as [])),
  },
}));

const { GenreCheckSchema, saveGenreChecks } = await import("@/lib/topics/genre-check");

describe("saveGenreChecks", () => {
  it("ジャンルを付け直し、報道のない告知だけを一覧から外す", async () => {
    const r = await saveGenreChecks([
      { id: 10, genre: "entertainment", notNews: true },
      { id: 11, genre: null, notNews: true },
      { id: 99, genre: "business", notNews: false },
    ]);
    // 報道された話題（10）は「告知」と判定されても外さない。知らない話題（99）は無視する
    expect(r).toEqual({ saved: 2, moved: 1, hidden: 1 });
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });

  it("結果がなければ何もしない", async () => {
    executeRaw.mockClear();
    expect(await saveGenreChecks([])).toEqual({ saved: 0, moved: 0, hidden: 0 });
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe("GenreCheckSchema", () => {
  it("サイトにないジャンルは受け付けない", () => {
    expect(GenreCheckSchema.safeParse({ results: [{ id: 1, genre: "politics", notNews: false }] }).success).toBe(false);
    expect(GenreCheckSchema.safeParse({ results: [{ id: 1, genre: null, notNews: false }] }).success).toBe(true);
  });
});
