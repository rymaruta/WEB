import { describe, expect, it } from "vitest";
import { DAILY_JOBS, JOBS, missedPublishJobs, resolveInterval } from "@/lib/scheduler/jobs";
import { msSinceJst } from "@/lib/digest/slots";

const crawl = JOBS.find((j) => j.name === "crawl")!;

describe("resolveInterval", () => {
  it("未設定なら既定値", () => expect(resolveInterval(crawl, {})).toBe(5));
  it("数値で上書きできる", () => expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "5" })).toBe(5));
  it("off で停止", () => expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "off" })).toBeNull());
  it("不正値は既定値", () => {
    expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "0" })).toBe(5);
    expect(resolveInterval(crawl, { CRAWL_INTERVAL_MINUTES: "abc" })).toBe(5);
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
  it("朝・昼・夜の下書きを投稿の50分前に作り、公式ストア・映画・テレビアニメの予定を朝に取り込む", () => {
    expect(DAILY_JOBS.filter((j) => !j.publish).map((j) => [j.path, j.at])).toEqual([
      ["/api/cron/digest?slot=MORNING", "06:10"],
      ["/api/cron/digest?slot=LUNCH", "11:10"],
      ["/api/cron/digest?slot=EVENING", "19:10"],
      ["/api/cron/game-listings", "05:10"],
      ["/api/cron/movie-listings", "05:20"],
      ["/api/cron/anime-listings", "05:25"],
    ]);
  });
  it("承認済みの回を 7:00・12:00・20:00 に、Threads の1本を 21:00 に投稿する", () => {
    expect(DAILY_JOBS.filter((j) => j.publish).map((j) => [j.path, j.at])).toEqual([
      ["/api/cron/publish?slot=MORNING", "07:00"],
      ["/api/cron/publish?slot=LUNCH", "12:00"],
      ["/api/cron/publish?slot=EVENING", "20:00"],
      ["/api/cron/threads-daily?run=1", "21:00"],
    ]);
  });
});

describe("missedPublishJobs", () => {
  it("投稿の時刻を過ぎて30分以内なら、その回を拾い直す", () => {
    const at = (iso: string) => new Date(iso);
    expect(missedPublishJobs(at("2026-10-01T20:03:00+09:00"), msSinceJst).map((j) => j.name)).toEqual(["publish-evening"]);
    expect(missedPublishJobs(at("2026-10-01T19:59:00+09:00"), msSinceJst)).toEqual([]);
    expect(missedPublishJobs(at("2026-10-01T20:45:00+09:00"), msSinceJst)).toEqual([]);
    expect(missedPublishJobs(at("2026-10-01T07:10:00+09:00"), msSinceJst).map((j) => j.name)).toEqual(["publish-morning"]);
  });
});
