import { describe, expect, it } from "vitest";
import { createActionToken, verifyActionToken } from "@/lib/admin/token";

const KEY = "k".repeat(40);
const ID = "cmuqyde87000001ad2seovwb3";

describe("メールのリンク用の鍵", () => {
  it("作った鍵で、その出来事の ID が分かる", () => {
    const t = createActionToken(ID, 0, KEY)!;
    expect(verifyActionToken(t, 1000, KEY)).toBe(ID);
  });
  it("期限切れ・別の鍵・改ざんは通らない", () => {
    const t = createActionToken(ID, 0, KEY)!;
    expect(verifyActionToken(t, 7 * 3_600_000, KEY)).toBeNull();
    expect(verifyActionToken(t, 1000, "x".repeat(40))).toBeNull();
    expect(verifyActionToken(t.replace(/^./, "A"), 1000, KEY)).toBeNull();
  });
  it("ログイン用の鍵とは別物（ログインの Cookie には使えない）", async () => {
    const { verifyToken } = await import("@/lib/admin/token");
    expect(verifyToken(createActionToken(ID, Date.now(), KEY)!, Date.now(), KEY)).toBe(false);
  });
});
