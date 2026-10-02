import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { bulkConfirmable } = await import("@/lib/digest/admin");

describe("bulkConfirmable", () => {
  const story = (statusNote: string, gossip = false) => ({ status: "REVIEW_REQUIRED", statusNote, assessment: { gossip } });
  it("理由が「慎重に扱う分野」だけなら、まとめて確認済みにしてよい", () => {
    expect(bulkConfirmable(story("慎重に扱う分野: 事件・事故"))).toBe(true);
    expect(bulkConfirmable(story("慎重に扱う分野: 政治\n慎重に扱う分野: 選挙"))).toBe(true);
  });
  it("文の中身に問題があるもの・ゴシップは人が確かめる", () => {
    expect(bulkConfirmable(story("慎重に扱う分野: 事件・事故\n資料に見つからない語: 逮捕"))).toBe(false);
    expect(bulkConfirmable(story("媒体間の食い違い: 人数"))).toBe(false);
    expect(bulkConfirmable(story("確からしさが低い（0.62）"))).toBe(false);
    expect(bulkConfirmable(story("慎重に扱う分野: 事件・事故", true))).toBe(false);
    expect(bulkConfirmable({ status: "PENDING", statusNote: null, assessment: null })).toBe(false);
  });
});
