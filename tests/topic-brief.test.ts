import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { buildBrief } = await import("@/lib/topics/brief");

const at = (d: number) => new Date(Date.UTC(2026, 9, d));
const timeline = [
  { id: 1, title: "台風10号が発生", firstSeenAt: at(1), publisherCount: 3 },
  { id: 2, title: "台風10号が上陸", firstSeenAt: at(2), publisherCount: 8 },
  { id: 3, title: "台風10号で各地に被害", firstSeenAt: at(3), publisherCount: 6 },
];

describe("buildBrief", () => {
  it("リードを「何が起きた」に、この話題より後の最新の話題を「その後」にする", () => {
    expect(buildBrief("台風10号が上陸した。", "物流に影響が出るため。", timeline, { id: 2, firstSeenAt: at(2) })).toEqual({
      what: "台風10号が上陸した。",
      why: "物流に影響が出るため。",
      next: { id: 3, title: "台風10号で各地に被害", at: at(3) },
    });
  });
  it("最新の話題なら続報はなし。リードがなければ出さない", () => {
    expect(buildBrief("被害が出た。", null, timeline, { id: 3, firstSeenAt: at(3) })?.next).toBeNull();
    expect(buildBrief(null, "理由", timeline, { id: 3, firstSeenAt: at(3) })).toBeNull();
  });
});

describe("その後（続報）の判定", () => {
  it("12時間以内に出た同じ出来事の話題は、続報にしない（同じ発表の別の媒体の記事）", () => {
    const tl = [
      { id: 1, title: "久保建英と福原遥が結婚を発表", firstSeenAt: new Date("2026-10-02T12:00:00Z"), publisherCount: 9 },
      { id: 2, title: "福原遥がサッカー久保建英と電撃婚", firstSeenAt: new Date("2026-10-02T20:00:00Z"), publisherCount: 2 },
    ];
    expect(buildBrief("結婚を発表した。", null, tl, { id: 1, firstSeenAt: tl[0].firstSeenAt })?.next).toBeNull();
  });
});
