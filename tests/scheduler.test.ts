import { describe, expect, it } from "vitest";
import { DAILY_JOBS, JOBS, resolveInterval } from "@/lib/scheduler/jobs";

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

import { selfHost } from "@/lib/scheduler/start";

describe("selfHost", () => {
  it("全アドレス・未設定なら 127.0.0.1", () => {
    expect(selfHost(undefined)).toBe("127.0.0.1");
    expect(selfHost("0.0.0.0")).toBe("127.0.0.1");
  });
  it("コンテナ名などはそのまま使う", () => expect(selfHost("ip-172-26-1-5")).toBe("ip-172-26-1-5"));
});

describe("DAILY_JOBS", () => {
  it("朝・昼・夜の下書きを、投稿の50分前に作る", () => {
    expect(DAILY_JOBS.map((j) => [j.path, j.at])).toEqual([
      ["/api/cron/digest?slot=MORNING", "06:10"],
      ["/api/cron/digest?slot=LUNCH", "11:10"],
      ["/api/cron/digest?slot=EVENING", "19:10"],
    ]);
  });
});
