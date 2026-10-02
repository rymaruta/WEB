import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { breakdown, featurePath, featureShortName, isFeatureMonth, jstMonth } = await import("@/lib/features");

describe("jstMonth", () => {
  it("日本時間の月を返し、月をまたいで進められる", () => {
    // 2026-09-30 16:00 UTC は日本時間 10月1日 1時
    expect(jstMonth(new Date("2026-09-30T16:00:00Z"))).toBe("2026-10");
    expect(jstMonth(new Date("2026-12-15T00:00:00Z"), 1)).toBe("2027-01");
  });
});

describe("isFeatureMonth", () => {
  const now = new Date("2026-10-02T00:00:00Z");
  it("作り始めた月から来月までを公開する", () => {
    expect(isFeatureMonth("2026-09", now)).toBe(true);
    expect(isFeatureMonth("2026-11", now)).toBe(true);
    expect(isFeatureMonth("2026-12", now)).toBe(false);
    expect(isFeatureMonth("2026-08", now)).toBe(false);
  });
  it("形のおかしい月は受け付けない", () => {
    expect(isFeatureMonth("2026-13", now)).toBe(false);
    expect(isFeatureMonth("2026-1", now)).toBe(false);
    expect(isFeatureMonth("../x", now)).toBe(false);
  });
});

describe("breakdown", () => {
  it("種類ごとの件数を多い順に並べる", () => {
    const items = [{ label: "値上げ" }, { label: "値下げ" }, { label: "値上げ" }, { label: null }];
    expect(breakdown(items)).toBe("値上げ 2件、値下げ 1件");
  });
});

describe("featurePath / featureShortName", () => {
  it("特集のアドレスと短い名前", () => {
    expect(featurePath("games", "2026-10")).toBe("/feature/games/2026-10");
    expect(featureShortName("changes", "2026-10")).toBe("10月から変わること");
    expect(featureShortName("anime", "2026-11")).toBe("11月からのアニメ");
  });
});
