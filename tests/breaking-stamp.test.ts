import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { edition: { findUnique, update } } }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ publishEdition: vi.fn() }));

const { stampBreakingTime } = await import("@/lib/digest/breaking");

const edition = (sent: boolean, override: unknown = null) => ({
  slot: "BREAKING",
  items: [{ override, story: { headline: ["日銀が追加利上げを決定"] } }],
  publications: sent ? [{ parts: [{ position: 0 }] }] : [],
});

describe("stampBreakingTime", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it("作ってから時間が空いても、投稿文の時刻を投稿する時刻に合わせる", async () => {
    findUnique.mockResolvedValue(edition(false));
    const now = new Date("2026-10-02T14:50:00+09:00");
    await stampBreakingTime("e1", now);
    expect(update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { scheduledAt: now, deadlineAt: now, postText: ["⚡ 速報（14:50時点）", "", "日銀が追加利上げを決定"] },
    });
  });

  it("人が直した見出しがあれば、その見出しで書き直す", async () => {
    findUnique.mockResolvedValue(edition(false, { headline: ["日銀が利上げ", "0.25%幅"] }));
    const now = new Date("2026-10-02T14:50:00+09:00");
    await stampBreakingTime("e1", now);
    expect(update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { scheduledAt: now, deadlineAt: now, postText: ["⚡ 速報（14:50時点）", "", "日銀が利上げ0.25%幅"] },
    });
  });

  it("途中まで送った回の続きでは、時刻を変えない", async () => {
    findUnique.mockResolvedValue(edition(true));
    await stampBreakingTime("e1", new Date());
    expect(update).not.toHaveBeenCalled();
  });

  it("定時の回では何もしない", async () => {
    findUnique.mockResolvedValue({ ...edition(false), slot: "EVENING" });
    await stampBreakingTime("e1", new Date());
    expect(update).not.toHaveBeenCalled();
  });
});
