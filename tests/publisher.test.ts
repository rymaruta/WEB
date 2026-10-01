import { describe, expect, it } from "vitest";
import { publisherLabel } from "@/lib/publisher";

describe("publisherLabel", () => {
  it("ドメイン名を媒体名にする", () => {
    expect(publisherLabel("tdb.co.jp")).toBe("帝国データバンク");
    expect(publisherLabel("www3.nhk.or.jp")).toBe("NHK");
    expect(publisherLabel("internet.watch.impress.co.jp")).toBe("INTERNET Watch");
  });
  it("知らないドメインと媒体名はそのまま", () => {
    expect(publisherLabel("timescar-lawsuit.com")).toBe("timescar-lawsuit.com");
    expect(publisherLabel("ITmedia")).toBe("ITmedia");
  });
});
