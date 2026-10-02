import { describe, expect, it, vi } from "vitest";

const calls: { op: string; args: unknown }[] = [];
vi.mock("@/lib/db", () => ({
  prisma: {
    topic: {
      findUniqueOrThrow: async () => ({ publisherCount: 3, aiHistory: [], aiGeneratedAt: null, aiSourceCount: null }),
      update: async (args: unknown) => void calls.push({ op: "topic.update", args }),
    },
    genre: { findUnique: async () => ({ id: 5 }) },
    topicArticleVersion: { create: async (args: unknown) => void calls.push({ op: "version.create", args }) },
  },
}));
vi.mock("@/lib/indexnow", () => ({ submitIndexNow: async () => {} }));

const { saveArticle } = await import("@/lib/ai/store");

describe("saveArticle", () => {
  it("記事を保存するたびに版を残し、ジャンルを決めた記録を付ける", async () => {
    const article = { title: "見出し", lead: "リード", body: ["段落1", "段落2"], points: [{ text: "要点", sources: [1] }], genre: "entertainment" } as never;
    await saveArticle(10, article, [101, 102], "claude-code");
    const update = calls.find((c) => c.op === "topic.update")!.args as { data: { genreNote: string } };
    expect(update.data.genreNote).toMatch(/^ai entertainment /);
    expect(calls.find((c) => c.op === "version.create")!.args).toEqual({
      data: { topicId: 10, title: "見出し", lead: "リード", body: "段落1\n\n段落2", points: [{ text: "要点", sources: [1] }], sources: [101, 102], model: "claude-code" },
    });
  });
});
