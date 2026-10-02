import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { isChangeCandidate, verifyChange } = await import("@/lib/changes");

describe("isChangeCandidate", () => {
  it("始まる時期と変更の語がある記事を候補にする", () => {
    expect(isChangeCandidate("郵便料金、10月1日から値上げ はがきは85円に")).toBe(true);
    expect(isChangeCandidate("マイナ保険証への移行、12月2日から本格開始")).toBe(true);
    expect(isChangeCandidate("改正道路交通法が11月から施行 自転車の罰則強化")).toBe(true);
    expect(isChangeCandidate("加熱式たばこ、10月1日から増税")).toBe(true);
    expect(isChangeCandidate("JR各社の運賃、来月から新しい額に")).toBe(true);
  });
  it("時期がない・変更でない記事は候補にしない", () => {
    expect(isChangeCandidate("電気料金の値上げを検討")).toBe(false);
    expect(isChangeCandidate("10月1日に新店舗がオープン")).toBe(false);
  });
});

describe("verifyChange", () => {
  const src = "郵便料金、10月1日から値上げ はがきは85円に\\n日本郵便は、はがきの料金を85円に引き上げると発表した。";
  it("資料の言葉でできていて、日付が資料にあるものは残す", () => {
    expect(verifyChange({ title: "郵便料金の値上げ", startDate: "2026-10-01", kind: "price_up" }, src)).toEqual({
      title: "郵便料金の値上げ",
      startDate: "2026-10-01",
      kind: "price_up",
    });
  });
  it("資料にない日付・数字・言葉は使わない", () => {
    expect(verifyChange({ title: "郵便料金の値上げ", startDate: "2026-11-01", kind: "price_up" }, src)).toBeNull();
    expect(verifyChange({ title: "はがき90円に値上げ", startDate: "2026-10-01", kind: "price_up" }, src)).toBeNull();
    expect(verifyChange({ title: "電気代の補助終了", startDate: "2026-10-01", kind: "end" }, src)).toBeNull();
  });
});
