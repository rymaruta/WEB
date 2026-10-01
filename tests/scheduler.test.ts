import { describe, expect, it } from "vitest";
import { JOBS, resolveInterval } from "@/lib/scheduler/jobs";

const crawl = JOBS.find((j) => j.name === "crawl")!;

describe("resolveInterval", () => {
  it("未設定なら既定値", () => expect(resolveInterval(crawl, {})).toBe(15));
  it("数値で上書きできる", () => expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "5" })).toBe(5));
  it("off で停止", () => expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "off" })).toBeNull());
  it("不正値は既定値", () => {
    expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "0" })).toBe(15);
    expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "abc" })).toBe(15);
  });
});
