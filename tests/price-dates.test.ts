import { describe, expect, it } from "vitest";
import { countdown, isUpcoming } from "@/lib/price-dates";

describe("値上げ・値下げの日付", () => {
  it("これから始まるものを見分ける（月までのものは今月以降）", () => {
    expect(isUpcoming("2026-10-02", "2026-10-02")).toBe(true);
    expect(isUpcoming("2026-10-01", "2026-10-02")).toBe(false);
    expect(isUpcoming("2026-10", "2026-10-02")).toBe(true);
    expect(isUpcoming("2026-09", "2026-10-02")).toBe(false);
  });
  it("始まるまでの目安", () => {
    expect(countdown("2026-10-02", "2026-10-02")).toBe("きょうから");
    expect(countdown("2026-10-03", "2026-10-02")).toBe("あすから");
    expect(countdown("2026-11-01", "2026-10-02")).toBe("あと30日");
    expect(countdown("2026-12", "2026-10-02")).toBe("12月中");
  });
});
