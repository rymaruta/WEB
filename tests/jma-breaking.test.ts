import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ publishEdition: vi.fn() }));

const { isSevereJmaTitle, jmaHeadline, jmaPostText } = await import("@/lib/digest/jma-breaking");
const { checkSingleHeadline } = await import("@/lib/digest/check");

describe("気象庁の発表からの速報", () => {
  it("震度5強以上・津波警報・噴火速報だけを速報にする", () => {
    expect(isSevereJmaTitle("能登半島沖で最大震度6弱の地震（M6.5）")).toBe(true);
    expect(isSevereJmaTitle("茨城県南部で最大震度5強の地震（M5.4）　津波の心配なし")).toBe(true);
    expect(isSevereJmaTitle("茨城県南部で最大震度5弱の地震（M5.0）")).toBe(false);
    expect(isSevereJmaTitle("千葉県東方沖で最大震度4の地震（M4.8）")).toBe(false);
    expect(isSevereJmaTitle("津波警報を発表")).toBe(true);
    expect(isSevereJmaTitle("大津波警報を発表")).toBe(true);
    expect(isSevereJmaTitle("津波注意報を発表")).toBe(false);
    expect(isSevereJmaTitle("津波警報を解除")).toBe(false);
    expect(isSevereJmaTitle("桜島に噴火速報")).toBe(true);
  });

  it("カードの見出し（1〜2行・各12字以内）", () => {
    expect(jmaHeadline("能登半島沖で最大震度6弱の地震（M6.5）")).toEqual(["最大震度6弱の地震", "能登半島沖 M6.5"]);
    expect(jmaHeadline("鹿児島県トカラ列島近海で最大震度5強の地震（M5.9）")).toEqual(["最大震度5強の地震", "鹿児島県トカラ列島近海"]);
    expect(jmaHeadline("大津波警報を発表")).toEqual(["大津波警報を発表", "気象庁"]);
    expect(jmaHeadline("桜島に噴火速報")).toEqual(["桜島", "噴火速報"]);
    for (const t of ["能登半島沖で最大震度6弱の地震（M6.5）", "津波警報を発表", "桜島に噴火速報"]) expect(checkSingleHeadline(jmaHeadline(t), false)).toEqual([]);
  });

  it("投稿文に気象庁の発表であることを書く", () => {
    expect(jmaPostText("津波警報を発表", new Date("2026-10-07T14:30:00Z"))).toEqual(["⚡ 速報（23:30時点・気象庁発表）", "", "津波警報を発表"]);
  });
});
