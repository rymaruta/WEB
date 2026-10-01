import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { edition: { findUnique, update } } }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));

const { stampLateEdition } = await import("@/lib/digest/publish");

const at = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00+09:00`);
const edition = (slot: string, sent = false) => ({ slot, scheduledAt: at("07:00"), publications: sent ? [{ parts: [{ position: 0 }] }] : [] });

describe("stampLateEdition", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it("予定より遅れて投稿するときは、カードの時刻を投稿の時刻にする", async () => {
    findUnique.mockResolvedValue(edition("MORNING"));
    expect(await stampLateEdition("e1", at("08:30"))).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { scheduledAt: at("08:30") } });
  });

  it("予定どおり（10分以内）なら変えない", async () => {
    findUnique.mockResolvedValue(edition("MORNING"));
    expect(await stampLateEdition("e1", at("07:03"))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("途中まで送った回の続きや、速報では変えない", async () => {
    findUnique.mockResolvedValue(edition("MORNING", true));
    expect(await stampLateEdition("e1", at("08:30"))).toBe(false);
    findUnique.mockResolvedValue(edition("BREAKING"));
    expect(await stampLateEdition("e1", at("08:30"))).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
