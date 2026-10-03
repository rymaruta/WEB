import { describe, expect, it, vi } from "vitest";
import type { Candidate } from "@/lib/digest/select";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ publishEdition: vi.fn() }));

const { AUTO_PICKUP, pickAutoPickup, pickupOk, pickupWindow } = await import("@/lib/digest/pickup-auto");

const jst = (hhmm: string) => new Date(`2026-10-03T${hhmm}:00+09:00`);
let n = 0;
const cand = (o: Partial<Candidate & { score: number }> = {}) => ({
  id: `c${n++}`,
  kind: "NEW" as const,
  status: "PENDING",
  category: "ECONOMY" as Candidate["category"],
  threadId: null,
  assessment: null,
  publisherCount: 5,
  hasPrimary: false,
  confidence: 0.9,
  clicks: 0,
  score: 40,
  ...o,
});

describe("日中の注目のニュースの自動投稿", () => {
  it("8時〜22時台だけ。前の投稿から60分以上あけ、1日8本まで", () => {
    expect(pickupWindow(jst("07:59"), null, 0)).toBe("quiet");
    expect(pickupWindow(jst("23:00"), null, 0)).toBe("quiet");
    expect(pickupWindow(jst("12:00"), null, AUTO_PICKUP.maxPerDay)).toBe("limit");
    expect(pickupWindow(jst("12:00"), jst("11:30"), 0)).toBe("gap");
    expect(pickupWindow(jst("12:00"), jst("10:59"), 0)).toBeNull();
  });

  it("独立3社以上・確からしさ0.8以上・照合済み（要確認は自動で使ってよいものだけ）・ゴシップと宣伝なし・基準点以上", () => {
    expect(pickupOk(cand())).toBe(true);
    expect(pickupOk(cand({ publisherCount: 2 }))).toBe(false);
    expect(pickupOk(cand({ confidence: 0.7 }))).toBe(false);
    expect(pickupOk(cand({ status: "REVIEW_REQUIRED" }))).toBe(false);
    expect(pickupOk(cand({ status: "REVIEW_REQUIRED", autoOk: true }))).toBe(true);
    expect(pickupOk(cand({ status: "QUEUED" }))).toBe(false);
    expect(pickupOk(cand({ kind: "FOLLOWUP" }))).toBe(false);
    expect(pickupOk(cand({ assessment: { impact: 2, longevity: 2, publicInterest: 2, actionable: false, gossip: true, promotional: false } }))).toBe(false);
    expect(pickupOk(cand({ score: 20 }))).toBe(false);
  });

  it("直前に出した枠と違う枠を優先し、その中で点数の高いもの", () => {
    const sports = cand({ category: "SPORTS", score: 60 });
    const econ = cand({ category: "ECONOMY", score: 45 });
    const tech = cand({ category: "TECH", score: 50 });
    expect(pickAutoPickup([sports, econ, tech], "soft")?.id).toBe(tech.id);
    expect(pickAutoPickup([sports, econ, tech], null)?.id).toBe(sports.id);
    expect(pickAutoPickup([cand({ publisherCount: 1 })], null)).toBeNull();
  });
});
