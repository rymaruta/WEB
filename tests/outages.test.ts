import { describe, expect, it } from "vitest";
import { isOutage, outageStatus } from "@/lib/outages";

describe("isOutage", () => {
  it("通信・アプリのサービスの障害を拾う", () => {
    expect(isOutage("ドコモで通信障害、一部地域でつながりにくく")).toBe(true);
    expect(isOutage("LINEでメッセージが送れない不具合")).toBe(true);
    expect(isOutage("AWSの東京リージョンで障害、復旧")).toBe(true);
    expect(isOutage("Xで障害、投稿が表示されず")).toBe(true);
  });
  it("病気や福祉の「障害」、サービスに関係ない記事は拾わない", () => {
    expect(isOutage("障害者雇用の法定率を引き上げ")).toBe(false);
    expect(isOutage("発達障害の支援アプリを公開")).toBe(false);
    expect(isOutage("台風被害の道路、復旧工事が完了")).toBe(false);
    expect(isOutage("新型車に不具合、リコール")).toBe(false);
  });
});

describe("outageStatus", () => {
  it("見出しに復旧とあれば復旧、なければ発生", () => {
    expect(outageStatus("ドコモの通信障害、全面復旧")).toBe("recovered");
    expect(outageStatus("ドコモの通信障害、復旧のめど立たず")).toBe("ongoing");
    expect(outageStatus("Xで障害")).toBe("ongoing");
  });
});
