import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ publishEdition: vi.fn() }));

const { breakingPostText, isJustBeforeSlot, isQuietHour, pickBreaking } = await import("@/lib/digest/breaking");

// 日本時間の時刻
const jst = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+09:00`);
const base = {
  id: "a",
  score: 10,
  publisherCount: 4,
  firstSeenAt: jst("14:00"),
  riskFlags: [] as string[],
  confidence: 0.9,
  assessment: null,
};

describe("pickBreaking", () => {
  const now = jst("14:30");
  it("条件を満たす候補のうち、話題の大きいものを選ぶ", () => {
    expect(pickBreaking([base, { ...base, id: "b", score: 20 }], now, 0)?.id).toBe("b");
  });
  it("媒体数・経過時間・確度・ゴシップで外す", () => {
    expect(pickBreaking([{ ...base, publisherCount: 2 }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...base, firstSeenAt: jst("10:00") }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...base, confidence: 0.5 }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...base, assessment: { gossip: true } as never }], now, 0)).toBeNull();
  });
  it("事件・死亡・選挙・政治の分野は出さない", () => {
    expect(pickBreaking([{ ...base, riskFlags: ["CRIME"] }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...base, riskFlags: ["MARKET"] }], now, 0)?.id).toBe("a");
  });
  it("1日2本まで", () => {
    expect(pickBreaking([base], now, 2)).toBeNull();
  });
  it("深夜は災害だけ", () => {
    const night = jst("23:30");
    const fresh = { ...base, firstSeenAt: jst("23:00") };
    expect(pickBreaking([fresh], night, 0)).toBeNull();
    expect(pickBreaking([{ ...fresh, riskFlags: ["DISASTER"] }], night, 0)?.id).toBe("a");
  });
  it("定時の配信の直前は出さない", () => {
    expect(pickBreaking([{ ...base, firstSeenAt: jst("19:30") }], jst("19:45"), 0)).toBeNull();
  });
});

describe("時刻の判定", () => {
  it("23時〜6時が深夜", () => {
    expect(isQuietHour(jst("23:00"))).toBe(true);
    expect(isQuietHour(jst("05:59"))).toBe(true);
    expect(isQuietHour(jst("06:00"))).toBe(false);
  });
  it("定時の20分前から直前まで", () => {
    expect(isJustBeforeSlot(jst("11:45"))).toBe(true);
    expect(isJustBeforeSlot(jst("11:30"))).toBe(false);
    expect(isJustBeforeSlot(jst("12:05"))).toBe(false);
  });
});

describe("breakingPostText", () => {
  it("時刻を明記する", () => {
    expect(breakingPostText(["東海道新幹線", "全線で運転見合わせ"], jst("14:32"))[0]).toBe("⚡ 速報（14:32時点）");
  });
});
