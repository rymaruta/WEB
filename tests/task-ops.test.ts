import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
const { urlAllowed } = await import("@/lib/admin/task-ops");

describe("urlAllowed", () => {
  it("URL のない投稿はいつでもよい", () => expect(urlAllowed("久保建英が結婚", "速報を投稿して")).toBe(true));
  it("URL 付きは、依頼でリンク・URL を求めたときだけ", () => {
    expect(urlAllowed("詳しくは https://zenbu-navi.com/topic/1", "速報を投稿して")).toBe(false);
    expect(urlAllowed("詳しくは https://zenbu-navi.com/topic/1", "記事のリンク付きで投稿して")).toBe(true);
  });
});
