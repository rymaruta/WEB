import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/ai/store", () => ({ countNewDueTopics: vi.fn() }));

const { shouldFire, DISPATCH_RULES } = await import("@/lib/digest/dispatch");
const rule = DISPATCH_RULES.articles;

describe("shouldFire", () => {
  it("仕事がなければ起動しない", () => expect(shouldFire(rule, 0, null, 12)).toBe(false));
  it("たまったら起動する", () => expect(shouldFire(rule, 10, 200, 12)).toBe(true));
  it("前の起動から間もなければ起動しない（3時間に1回まで）", () => expect(shouldFire(rule, 30, 170, 12)).toBe(false));
  it("少なくても、時間がたてば起動する", () => {
    expect(shouldFire(rule, 1, 300, 12)).toBe(false);
    expect(shouldFire(rule, 1, 370, 12)).toBe(true);
  });
  it("深夜（1〜6時）は起動しない", () => expect(shouldFire(rule, 30, null, 3)).toBe(false));
});

describe("beforeBuild", () => {
  it("下書きを作る25〜70分前だけ", async () => {
    const { beforeBuild } = await import("@/lib/digest/dispatch");
    // 昼・夜のまとめは止めたので、その前は対象外
    expect(beforeBuild(new Date("2026-10-03T10:20:00+09:00"))).toBe(false);
    expect(beforeBuild(new Date("2026-10-03T18:20:00+09:00"))).toBe(false);
    // 朝の下書き 06:10 の前（深夜の時間帯でも）
    expect(beforeBuild(new Date("2026-10-03T05:20:00+09:00"))).toBe(true);
  });
});

describe("articlesPending", async () => {
  const { articlesPending } = await import("@/lib/digest/dispatch");
  it("ジャンルの確認待ちも、20 件で 1 件分として数える（書く記事がなくても確認が止まらないように）", () => {
    expect(articlesPending(0, 160)).toBe(8);
    expect(articlesPending(3, 19)).toBe(3);
    expect(articlesPending(2, 60)).toBe(5);
  });
});
