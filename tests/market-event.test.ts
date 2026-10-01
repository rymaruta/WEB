import { describe, expect, it } from "vitest";
import { marketEventLabel, verifyMarketEvent } from "@/lib/market-event";

describe("verifyMarketEvent", () => {
  it("資料に裏付けの言葉があれば認める", () => {
    expect(verifyMarketEvent("earnings", "米Micron、売上高4.8倍 純利益は過去最高")).toBe("earnings");
    expect(verifyMarketEvent("deal", "日本製鉄がUSスチールを買収")).toBe("deal");
  });
  it("裏付けがなければ目印を付けない", () => {
    expect(verifyMarketEvent("earnings", "新型スマートフォンを発表")).toBeNull();
    expect(verifyMarketEvent(null, "決算")).toBeNull();
  });
  it("表示名を返す", () => {
    expect(marketEventLabel("forecast")).toBe("業績予想");
    expect(marketEventLabel("unknown")).toBeNull();
  });
});
