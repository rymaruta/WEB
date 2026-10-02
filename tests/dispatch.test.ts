import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/ai/store", () => ({ countNewDueTopics: vi.fn() }));

const { shouldFire, DISPATCH_RULES } = await import("@/lib/digest/dispatch");
const rule = DISPATCH_RULES.articles;

describe("shouldFire", () => {
  it("仕事がなければ起動しない", () => expect(shouldFire(rule, 0, null, 12)).toBe(false));
  it("たまったら起動する", () => expect(shouldFire(rule, 5, 60, 12)).toBe(true));
  it("前の起動から間もなければ起動しない", () => expect(shouldFire(rule, 30, 20, 12)).toBe(false));
  it("少なくても、時間がたてば起動する", () => {
    expect(shouldFire(rule, 1, 60, 12)).toBe(false);
    expect(shouldFire(rule, 1, 130, 12)).toBe(true);
  });
  it("深夜（1〜6時）は起動しない", () => expect(shouldFire(rule, 30, null, 3)).toBe(false));
});
