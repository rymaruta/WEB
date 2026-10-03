import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ publishEdition: vi.fn() }));
// 知名度: 久保建英・福原遥・メッシ・エヌビディアは有名、それ以外は無名とする
const FAMOUS = ["久保建英", "福原遥", "メッシ", "エヌビディア", "レアル・マドリード", "ドジャース"];
vi.mock("@/lib/fame", () => ({
  famousSubject: async (title: string) => {
    const f = FAMOUS.find((n) => title.includes(n));
    return f ? { term: f, title: f, views: 100_000, sitelinks: 50 } : null;
  },
}));

const { publicInterest } = await import("@/lib/digest/breaking");

describe("速報にする出来事（世間の関心）", () => {
  it("誰もが知っている人・会社の出来事は速報にする", async () => {
    expect(await publicInterest({ title: "久保建英選手と福原遥さんが結婚を発表", publisherCount: 3 })).toBeTruthy();
    expect(await publicInterest({ title: "エヌビディア、時価総額で世界首位に", publisherCount: 2 })).toBeTruthy();
  });

  it("無名の人の出来事は、媒体が多くなければ速報にしない", async () => {
    expect(await publicInterest({ title: "地元の会社社長が結婚", publisherCount: 3 })).toBeNull();
    expect(await publicInterest({ title: "地元の会社社長が結婚", publisherCount: 8 })).toBeTruthy();
  });

  it("災害は知名度を問わない", async () => {
    expect(await publicInterest({ title: "震度6強の地震 津波の心配なし", publisherCount: 1 })).toBe("災害");
  });

  it("スポーツは節目だけ。負け・年代別・公営競技は速報にしない", async () => {
    expect(await publicInterest({ title: "メッシが通算900ゴール、世界新", publisherCount: 3, sports: true })).toBeTruthy();
    expect(await publicInterest({ title: "日本代表がアジア杯で優勝", publisherCount: 3, sports: true })).toBe("日本代表");
    expect(await publicInterest({ title: "U-21日本代表がアジア大会で優勝", publisherCount: 9, sports: true })).toBeNull();
    expect(await publicInterest({ title: "日本代表、ブラジルに敗れる", publisherCount: 9, sports: true })).toBeNull();
    expect(await publicInterest({ title: "児島ボート 藤原啓史朗が優勝", publisherCount: 2, sports: true })).toBeNull();
    expect(await publicInterest({ title: "無名選手が優勝", publisherCount: 9, sports: true })).toBeNull();
  });

  it("有名クラブへの移籍・メジャーリーグへの移籍は速報にする", async () => {
    expect(await publicInterest({ title: "日本人MFがレアル・マドリードへ完全移籍", publisherCount: 3, sports: true })).toBeTruthy();
    expect(await publicInterest({ title: "佐藤投手、ドジャースと契約 メジャー挑戦", publisherCount: 3, sports: true })).toBeTruthy();
    expect(await publicInterest({ title: "J3の選手が地域リーグへ移籍", publisherCount: 3, sports: true })).toBeNull();
  });
});
