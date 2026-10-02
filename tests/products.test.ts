import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { isProductCandidate, jstWeeks, verifyProduct } = await import("@/lib/products");

describe("isProductCandidate", () => {
  it("日付つきの発売の記事を候補にする", () => {
    expect(isProductCandidate("ソニー「Xperia 10 VIII」を10月8日発売、9万9000円")).toBe(true);
    expect(isProductCandidate("夜専用メガネの新モデル「ナイトグラスLEDルナ」を10月1日より発売")).toBe(true);
  });
  it("日付のない記事・レポートの発売は候補にしない", () => {
    expect(isProductCandidate("クリスマスケーキ2種が登場")).toBe(false);
    expect(isProductCandidate("2027年春の消費変化レポートを10月1日に発売")).toBe(false);
  });
});

describe("verifyProduct", () => {
  const src = "ソニー「Xperia 10 VIII」を10月8日発売、9万9000円";
  it("商品名と日付が資料にあれば残す。会社名は資料になければ外す", () => {
    expect(verifyProduct({ name: "Xperia 10 VIII", maker: "ソニー", date: "2026-10-08", kind: "gadget" }, src)).toEqual({
      name: "Xperia 10 VIII",
      maker: "ソニー",
      date: "2026-10-08",
      kind: "gadget",
    });
    expect(verifyProduct({ name: "Xperia 10 VIII", maker: "アップル", date: "2026-10-08", kind: "gadget" }, src)?.maker).toBeNull();
  });
  it("資料にない商品名・日付は使わない", () => {
    expect(verifyProduct({ name: "Xperia 11", maker: null, date: "2026-10-08", kind: "gadget" }, src)).toBeNull();
    expect(verifyProduct({ name: "Xperia 10 VIII", maker: null, date: "2026-10-09", kind: "gadget" }, src)).toBeNull();
  });
});

describe("jstWeeks", () => {
  it("月曜はじまりで今週・来週を返す", () => {
    // 2026-10-02 は金曜
    expect(jstWeeks(new Date("2026-10-02T09:00:00+09:00"))).toEqual({
      thisWeek: { from: "2026-09-28", to: "2026-10-04" },
      nextWeek: { from: "2026-10-05", to: "2026-10-11" },
    });
  });
});
