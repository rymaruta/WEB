import { describe, expect, it, vi } from "vitest";

const now = new Date("2026-10-02T09:00:00Z");
const recent = new Date("2026-10-02T08:00:00Z");
const old = new Date("2026-09-25T08:00:00Z");
const updates: unknown[] = [];
const merges: unknown[] = [];
const logs: string[] = [];
const t = (id: number, title: string, o: Record<string, unknown> = {}) => ({
  id,
  title,
  firstSeenAt: recent,
  publisherCount: 2,
  aiGeneratedAt: null,
  aiNotNews: false,
  mergedIntoId: null,
  lastSeenAt: recent,
  ...o,
});
vi.mock("@/lib/db", () => ({
  prisma: {
    topic: {
      findMany: async () => [
        t(1, "久保建英と福原遥が結婚を発表", { publisherCount: 4 }),
        t(2, "福原遥、サッカー久保建英と電撃婚"),
        t(3, "久保建英が結婚", { mergedIntoId: 9 }),
        t(4, "久保建英の結婚に祝福", { lastSeenAt: old }),
        t(6, "日銀が利上げを決定"),
      ],
      update: (args: unknown) => (updates.push(args), args),
      findUnique: async () => ({ mergedIntoId: 1 }),
    },
    article: {
      findMany: async () => [{ id: 21 }, { id: 22 }],
      updateMany: (args: unknown) => (updates.push(args), { count: 2 }),
    },
    topicMerge: {
      create: (args: unknown) => (merges.push(args), args),
      findUnique: async () => ({ id: 7, keepId: 1, dropId: 2, articleIds: [21, 22], dropWasNotNews: false, undoneAt: null }),
      update: (args: unknown) => (updates.push(args), args),
    },
    $transaction: async (ops: unknown[]) => ops,
  },
}));
vi.mock("@/lib/events", () => ({ logEvent: async (_l: string, scope: string, msg: string) => void logs.push(`${scope}: ${msg}`) }));
const refresh = vi.fn<(ids: number[]) => Promise<void>>(async () => {});
vi.mock("@/lib/topics/cluster", () => ({ refreshTopics: (ids: number[]) => refresh(ids) }));

const { mergeTopics, undoMerge } = await import("@/lib/topics/genre-check");

describe("mergeTopics", () => {
  it("報じた媒体の多いほうへまとめ、移した記事と理由を記録する", async () => {
    expect(await mergeTopics([[2, 1]], now)).toBe(1);
    expect(updates).toEqual([
      { where: { topicId: 2 }, data: { topicId: 1 } },
      { where: { id: 2 }, data: { mergedIntoId: 1, aiNotNews: true } },
    ]);
    expect(merges).toEqual([
      { data: { keepId: 1, dropId: 2, articleIds: [21, 22], dropWasNotNews: false, source: "ai", reason: expect.stringContaining("久保建英") } },
    ]);
    expect(refresh).toHaveBeenCalledWith([1]);
  });

  it("すでにまとめた話題・一覧に出る期間を過ぎた話題・自分自身はまとめない", async () => {
    updates.length = 0;
    expect(await mergeTopics([[1, 3], [1, 4], [5, 1]], now)).toBe(0);
    expect(updates).toEqual([]);
  });

  it("AI の判定でも、見出しに共通の固有の語がなければまとめず、記録を残す", async () => {
    updates.length = 0;
    expect(await mergeTopics([[1, 6]], now)).toBe(0);
    expect(updates).toEqual([]);
    expect(logs.at(-1)).toMatch(/^topic\.merge-rejected: 1 と 6 はまとめない（見出しに共通の固有の語がない）/);
  });

  it("運営者の指示なら、共通の語がなくてもまとめる", async () => {
    expect(await mergeTopics([[1, 6]], now, { source: "admin" })).toBe(1);
  });
});

describe("undoMerge", () => {
  it("移した記事を元の話題へ戻し、元の話題を一覧に戻す", async () => {
    updates.length = 0;
    refresh.mockClear();
    expect(await undoMerge(7)).toEqual({ ok: true, restored: 2 });
    expect(updates[0]).toEqual({ where: { id: { in: [21, 22] }, topicId: 1 }, data: { topicId: 2 } });
    expect(updates[1]).toEqual({ where: { id: 2 }, data: { mergedIntoId: null, aiNotNews: false } });
    expect(refresh).toHaveBeenCalledWith([1, 2]);
  });
});
