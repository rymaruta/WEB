import { afterEach, describe, expect, it } from "vitest";
import { isLocked, recordFailure, recordSuccess } from "@/lib/admin/rate-limit";
import { createToken, passwordMatches, verifyToken } from "@/lib/admin/token";
import { checkOverride } from "@/lib/digest/check";

const KEY = "x".repeat(40);

describe("管理画面のログイン", () => {
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });
  it("署名と期限が正しいトークンだけを通す", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    const t = createToken(now, KEY)!;
    expect(verifyToken(t, now + 1000, KEY)).toBe(true);
    expect(verifyToken(t, now + 15 * 86_400_000, KEY)).toBe(false);
    expect(verifyToken(t, now, "y".repeat(40))).toBe(false);
    expect(verifyToken(t.replace(/.$/, (c) => (c === "A" ? "B" : "A")), now, KEY)).toBe(false);
    expect(verifyToken(undefined, now, KEY)).toBe(false);
  });
  it("鍵がなければトークンを作らない（管理画面は使えない）", () => {
    expect(createToken(Date.now(), null)).toBeNull();
  });
  it("パスワードの照合", () => {
    process.env.ADMIN_PASSWORD = "correct horse";
    expect(passwordMatches("correct horse")).toBe(true);
    expect(passwordMatches("wrong")).toBe(false);
  });
  it("パスワード未設定なら常に失敗", () => {
    expect(passwordMatches("")).toBe(false);
  });
  it("5 回失敗すると一定時間ログインできない", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) recordFailure("ip", now);
    expect(isLocked("ip", now + 1000)).toBe(true);
    expect(isLocked("ip", now + 16 * 60_000)).toBe(false);
    recordSuccess("ip");
    expect(isLocked("ip", now)).toBe(false);
  });
});

describe("人による編集の文字数チェック", () => {
  it("上限を超えたら理由を返す", () => {
    const notes = checkOverride({ headline: ["一二三四五六七八九十一二三"], points: [{ text: "短い", sources: [1] }], keyword: "とても長いキーワードです" });
    expect(notes.some((n) => n.includes("見出し1行目"))).toBe(true);
    expect(notes.some((n) => n.includes("要点は"))).toBe(true);
    expect(notes.some((n) => n.includes("キーワード"))).toBe(true);
  });
  it("上限内なら問題なし", () => {
    expect(checkOverride({ headline: ["見出し"], points: [{ text: "一", sources: [1] }, { text: "二", sources: [1] }] })).toEqual([]);
  });
});
