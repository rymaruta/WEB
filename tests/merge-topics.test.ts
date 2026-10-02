import { describe, expect, it, vi } from "vitest";

const now = new Date("2026-10-02T09:00:00Z");
const recent = new Date("2026-10-02T08:00:00Z");
const old = new Date("2026-09-25T08:00:00Z");
const updates: unknown[] = [];
vi.mock("@/lib/db", () => ({
  prisma: {
    topic: {
      findMany: async () => [
        { id: 1, publisherCount: 4, aiGeneratedAt: null, mergedIntoId: null, lastSeenAt: recent },
        { id: 2, publisherCount: 2, aiGeneratedAt: null, mergedIntoId: null, lastSeenAt: recent },
        { id: 3, publisherCount: 2, aiGeneratedAt: null, mergedIntoId: 9, lastSeenAt: recent },
        { id: 4, publisherCount: 2, aiGeneratedAt: null, mergedIntoId: null, lastSeenAt: old },
      ],
      update: (args: unknown) => (updates.push(args), args),
    },
    article: { updateMany: (args: unknown) => (updates.push(args), args) },
    $transaction: async (ops: unknown[]) => ops,
  },
}));
const refresh = vi.fn(async () => {});
vi.mock("@/lib/topics/cluster", () => ({ refreshTopics: (ids: number[]) => refresh(ids) }));

const { mergeTopics } = await import("@/lib/topics/genre-check");

describe("mergeTopics", () => {
  it("報じた媒体の多いほうへまとめ、まとめた側に移した先を記録する", async () => {
    expect(await mergeTopics([[2, 1]], now)).toBe(1);
    expect(updates).toEqual([
      { where: { topicId: 2 }, data: { topicId: 1 } },
      { where: { id: 2 }, data: { mergedIntoId: 1, aiNotNews: true } },
    ]);
    expect(refresh).toHaveBeenCalledWith([1]);
  });
  it("すでにまとめた話題・一覧に出る期間を過ぎた話題・自分自身はまとめない", async () => {
    updates.length = 0;
    expect(await mergeTopics([[1, 3], [1, 4], [5, 1]], now)).toBe(0);
    expect(updates).toEqual([]);
  });
});
