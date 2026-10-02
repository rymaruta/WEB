import { describe, expect, it } from "vitest";
import { parseBojSeries, parseJgbCsv } from "@/lib/market";

describe("parseBojSeries", () => {
  it("値のない日を除いて、最新とその前の値を返す", () => {
    const json = { RESULTSET: [{ SERIES_CODE: "FXERD04", VALUES: { SURVEY_DATES: [20260929, 20260930, 20261001], VALUES: [157.38, 156.91, null] } }] };
    expect(parseBojSeries(json, "FXERD04")).toEqual({ value: 156.91, prev: 157.38, date: "2026-09-30" });
    expect(parseBojSeries(json, "XXX")).toBeNull();
  });
});

describe("parseJgbCsv", () => {
  it("10年の列を読み、和暦の日付を直す", () => {
    const csv = [
      "国債金利情報 (令和8年10月),,,,,,,,,,,,,,,(単位 : %)",
      "基準日,1年,2年,3年,4年,5年,6年,7年,8年,9年,10年,15年,20年,25年,30年,40年",
      "R8.9.30,1.684,1.952,2.086,2.273,2.399,2.525,2.639,2.796,2.926,3.057,3.583,3.877,4.1,4.1,4.1",
      "R8.10.1,1.668,1.939,2.077,2.274,2.407,2.534,2.657,2.82,2.952,3.092,3.62,3.91,4.154,4.122,4.125",
      ",,,,,,,,,,,,,,,",
      "※最新のcsvデータがダウンロードできない場合…,,,,,,,,,,,,,,,",
    ].join("\r\n");
    expect(parseJgbCsv(csv)).toEqual({ value: 3.092, prev: 3.057, date: "2026-10-01" });
  });
});
