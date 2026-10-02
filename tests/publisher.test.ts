import { describe, expect, it } from "vitest";
import { hasPublisherName, publisherLabel } from "@/lib/publisher";

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

describe("publisherLabel（名前の分からないドメイン）", () => {
  it("先頭の www・www2 を外して短くする", () => {
    expect(publisherLabel("www2.sagawa-exp.co.jp")).toBe("sagawa-exp.co.jp");
    expect(publisherLabel("www3.nhk.or.jp")).toBe("NHK");
    expect(publisherLabel("文春オンライン")).toBe("文春オンライン");
  });
});

describe("hasPublisherName", () => {
  it("名前の分からないサイトだけ false", () => {
    expect(hasPublisherName("www2.sagawa-exp.co.jp")).toBe(false);
    expect(hasPublisherName("www3.nhk.or.jp")).toBe(true);
    expect(hasPublisherName("文春オンライン")).toBe(true);
  });
});
