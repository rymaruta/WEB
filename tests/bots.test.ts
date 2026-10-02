import { describe, expect, it } from "vitest";
import { clickCookie, isBot, recentClicks } from "@/lib/bots";

describe("isBot", () => {
  it("検索エンジン・スクリプト・空の user-agent は人でない", () => {
    for (const ua of ["Googlebot/2.1", "python-requests/2.31", "curl/8.0", "node-fetch/1.0", "", null]) expect(isBot(ua)).toBe(true);
  });
  it("一般のブラウザーは人", () => {
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});

describe("クリックの重複除外", () => {
  it("Cookie から直近の記事を読み、数えた記事を先頭に足す", () => {
    expect(recentClicks("a=1; zn_go=5.3.9")).toEqual([5, 3, 9]);
    expect(recentClicks(null)).toEqual([]);
    expect(clickCookie([5, 3], 3)).toMatch(/^zn_go=3\.5; Max-Age=1800; Path=\/go; HttpOnly; Secure; SameSite=Lax$/);
  });
  it("30件までしか覚えない", () => {
    const ids = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(clickCookie(ids, 99).split(";")[0].split("=")[1].split(".")).toHaveLength(30);
  });
});
