import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { isChangeCandidate, verifyChange, verifyPrice, yenInText } = await import("@/lib/changes");

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
      company: null,
      priceBefore: null,
      priceAfter: null,
      rate: null,
    });
  });
  it("資料にない日付・数字・言葉は使わない", () => {
    expect(verifyChange({ title: "郵便料金の値上げ", startDate: "2026-11-01", kind: "price_up" }, src)).toBeNull();
    expect(verifyChange({ title: "はがき90円に値上げ", startDate: "2026-10-01", kind: "price_up" }, src)).toBeNull();
    expect(verifyChange({ title: "電気代の補助終了", startDate: "2026-10-01", kind: "end" }, src)).toBeNull();
  });
});

describe("verifyPrice", () => {
  const src = "Google Storeで「Pixel 10a」が1万2900円値上げ 9万2800円から（7万9900円→9万2800円、約16%）。Googleが発表";
  it("円の金額は、どの書き方でも見つける", () => {
    expect(yenInText(92800, src)).toBe(true);
    expect(yenInText(79900, src)).toBe(true);
    expect(yenInText(12900, src)).toBe(true);
    expect(yenInText(9280, src)).toBe(false);
    expect(yenInText(1500, "1,500円に")).toBe(true);
  });
  it("資料にある会社・値段・率だけを残す", () => {
    expect(verifyPrice({ kind: "price_up", company: "Google", priceBefore: 79900, priceAfter: 92800, rate: 16 }, src)).toEqual({
      company: "Google",
      priceBefore: 79900,
      priceAfter: 92800,
      rate: 16,
    });
  });
  it("値段の向きが種類と合わない・資料にない値段は捨てる", () => {
    expect(verifyPrice({ kind: "price_down", priceBefore: 79900, priceAfter: 92800 }, src).priceAfter).toBeNull();
    expect(verifyPrice({ kind: "price_up", priceBefore: 70000, priceAfter: 92800 }, src).priceBefore).toBeNull();
    expect(verifyPrice({ kind: "price_up", company: "アップル", rate: 20 }, src)).toEqual({ company: null, priceBefore: null, priceAfter: null, rate: null });
  });
  it("値上げ・値下げでなければ何も入れない", () => {
    expect(verifyPrice({ kind: "rule", company: "Google" }, src).company).toBeNull();
  });
});
