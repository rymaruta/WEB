import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ publishEdition: vi.fn() }));

const { BREAKING_RULES, breakingPostText, HOT_RULES, skipReason, isJustBeforeSlot, isQuietHour, pickBreaking, pickHotTopics } = await import("@/lib/digest/breaking");

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
  it("1日の上限まで", () => {
    expect(pickBreaking([base], now, BREAKING_RULES.maxPerDay)).toBeNull();
  });
  it("大きな出来事は、速報の判定でなくても2媒体・高い確度なら出す", () => {
    const hot = { ...base, breaking: false, hot: true, publisherCount: 2, confidence: 0.9 };
    expect(pickBreaking([hot], now, 0)?.id).toBe("a");
    expect(pickBreaking([{ ...hot, confidence: 0.8 }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...hot, publisherCount: 1 }], now, 0)).toBeNull();
    // 1媒体でも、信頼できる媒体で確度がとても高ければ出す
    expect(pickBreaking([{ ...hot, publisherCount: 1, trusted: true, confidence: 0.95 }], now, 0)?.id).toBe("a");
    expect(pickBreaking([{ ...hot, publisherCount: 1, trusted: true, confidence: 0.88 }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...hot, hot: false }], now, 0)).toBeNull();
    expect(pickBreaking([{ ...hot, assessment: { gossip: true } as never }], now, 0)).toBeNull();
  });
  it("人が求めた出来事は、媒体の数によらず確度が高ければ出す（深夜でも）", () => {
    const req = { ...base, breaking: false, publisherCount: 1, requested: true, confidence: 0.86 };
    expect(pickBreaking([req], now, 0)?.id).toBe("a");
    expect(pickBreaking([{ ...req, firstSeenAt: jst("23:00") }], jst("23:30"), 0)?.id).toBe("a");
    expect(pickBreaking([{ ...req, confidence: 0.7 }], now, 0)).toBeNull();
    expect(skipReason({ ...req, confidence: 0.7 })).toContain("70%");
    expect(skipReason({ ...req, riskFlags: ["DEATH"] })).toContain("訃報");
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

describe("pickHotTopics", () => {
  const now = new Date("2026-10-02T14:30:00Z");
  const t = (id: number, publisherCount: number, minutesAgo: number) => ({ id, publisherCount, firstSeenAt: new Date(now.getTime() - minutesAgo * 60_000) });

  it("一斉に報じられた新しい出来事を、媒体の多い順に選ぶ", () => {
    expect(pickHotTopics([t(1, 5, 30), t(2, 8, 60), t(3, 3, 10)], new Set(), now, 0).map((x) => x.id)).toEqual([2, 1]);
  });

  it("知らせ済み・古い出来事は選ばない", () => {
    expect(pickHotTopics([t(1, 9, 30), t(2, 9, 200)], new Set([1]), now, 0)).toEqual([]);
  });

  it("1日の上限を超えない", () => {
    expect(pickHotTopics([t(1, 9, 30), t(2, 8, 30)], new Set(), now, HOT_RULES.maxPerDay - 1).map((x) => x.id)).toEqual([1]);
  });
});
