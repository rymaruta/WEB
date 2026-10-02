import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events", () => ({ logEvent: async () => {} }));
const { failedSources } = await import("@/lib/listings-log");

describe("failedSources", () => {
  it("配信元ごとの失敗を拾う", () => {
    expect(failedSources({ nintendo: { fetched: 10, removed: 0 }, steam: { error: "empty" } })).toEqual(["steam: empty"]);
    expect(failedSources({ fetched: 300, removed: 0 })).toEqual([]);
    expect(failedSources(null)).toEqual([]);
  });
});
