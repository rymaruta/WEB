import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { buildRelatedPrompt, verifyBackground } = await import("@/lib/ai/related");

const related = [
  { id: 10, firstSeenAt: new Date("2026-09-19T03:00:00Z"), title: "猪俣周杜さんを傷害容疑で逮捕", lead: "警視庁は19日、timelesz の猪俣周杜さんを傷害の疑いで逮捕した。" },
  { id: 11, firstSeenAt: new Date("2026-09-22T03:00:00Z"), title: "猪俣周杜さんが釈放", lead: "猪俣周杜さんが処分保留のまま釈放された。" },
];

describe("verifyBackground", () => {
  it("材料にある話題だけを、古い順に残す", () => {
    const r = verifyBackground(
      [
        { topicId: 11, text: "猪俣周杜さんは処分保留のまま釈放された。" },
        { topicId: 10, text: "9月19日、猪俣周杜さんが傷害の疑いで逮捕された。" },
        { topicId: 99, text: "材料にない話題" },
      ],
      related,
    );
    expect(r.map((b) => b.topicId)).toEqual([10, 11]);
  });
  it("材料にない数字や固有名詞を含む文は載せない", () => {
    expect(verifyBackground([{ topicId: 10, text: "猪俣さんは罰金50万円を科された。" }], related)).toEqual([]);
    expect(verifyBackground([{ topicId: 11, text: "「STARTO」が会見を開いた。" }], related)).toEqual([]);
  });
  it("同じ話題は1回だけ、なければ空", () => {
    expect(verifyBackground(undefined, related)).toEqual([]);
    const twice = verifyBackground(
      [
        { topicId: 11, text: "釈放された。" },
        { topicId: 11, text: "処分保留となった。" },
      ],
      related,
    );
    expect(twice).toHaveLength(1);
  });
});

describe("buildRelatedPrompt", () => {
  it("材料がなければ何も足さない。あれば id つきで並べる", () => {
    expect(buildRelatedPrompt([])).toBe("");
    const p = buildRelatedPrompt(related);
    expect(p).toContain("{id: 10}");
    expect(p).toContain("見出し: 猪俣周杜さんが釈放");
  });
});
