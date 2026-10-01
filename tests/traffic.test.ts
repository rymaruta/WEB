import { describe, expect, it } from "vitest";
import { classifyReferrer, normalizePath } from "@/lib/traffic";

describe("classifyReferrer", () => {
  const host = "zenbu-navi.com";
  it("主な流入元を分類し、サイト内の移動は数えない", () => {
    expect(classifyReferrer("", host)).toBe("direct");
    expect(classifyReferrer("https://t.co/abc", host)).toBe("x");
    expect(classifyReferrer("https://www.google.co.jp/", host)).toBe("google");
    expect(classifyReferrer("https://news.google.com/", host)).toBe("google_news");
    expect(classifyReferrer("https://search.yahoo.co.jp/search?p=x", host)).toBe("yahoo");
    expect(classifyReferrer("https://b.hatena.ne.jp/", host)).toBe("social");
    expect(classifyReferrer("https://example.com/", host)).toBe("other");
    expect(classifyReferrer("https://zenbu-navi.com/ranking", host)).toBeNull();
    expect(classifyReferrer("not a url", host)).toBe("other");
  });
});

describe("normalizePath", () => {
  it("クエリを除き、管理画面や API は数えない", () => {
    expect(normalizePath("/topic/12?utm=x#a")).toBe("/topic/12");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/digest/")).toBe("/digest");
    expect(normalizePath("/admin")).toBeNull();
    expect(normalizePath("/api/pv")).toBeNull();
    expect(normalizePath("https://evil.example/")).toBeNull();
  });
});
