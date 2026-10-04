import { describe, expect, it } from "vitest";
import { isAdSensitive } from "@/lib/ad-eligibility";

describe("広告を出さない話題", () => {
  it("死去・事件・性的な内容の見出しは広告の対象外", () => {
    expect(isAdSensitive("オリックスの19歳投手が死去")).toBe(true);
    expect(isAdSensitive("女性の体を触った疑いで男を逮捕")).toBe(true);
    expect(isAdSensitive(null, "死刑執行に失敗、米国")).toBe(true);
  });
  it("ふつうのニュースは広告の対象", () => {
    expect(isAdSensitive("Windows 11 の年次更新「26H2」が配信開始", "新機能を追加")).toBe(false);
  });
});
