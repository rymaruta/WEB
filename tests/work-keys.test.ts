import { describe, expect, it, vi } from "vitest";
import { daysUntil, isPast, longDate, readWorkParam, workKey, workPath } from "@/lib/work-keys";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { answer } = await import("@/components/work-page");

describe("作品の呼び名とアドレス", () => {
  it("表記の違いを吸収する", () => {
    expect(workKey("ドラゴンクエスト Ⅻ：選ばれし運命の炎")).toBe(workKey("ドラゴンクエストⅫ 選ばれし運命の炎"));
    expect(workKey("ELDEN RING")).toBe("eldenring");
  });
  it("アドレスを作り、読み戻せる", () => {
    const path = workPath("game", workKey("マリオカート ワールド"));
    expect(readWorkParam(path.split("/")[2])).toBe(workKey("マリオカート ワールド"));
  });
});

describe("日付", () => {
  it("表示と残り日数", () => {
    expect(longDate("2026-11-20")).toBe("2026年11月20日（金）");
    expect(longDate("2026-12")).toBe("2026年12月");
    expect(daysUntil("2026-10-12", "2026-10-02")).toBe(10);
    expect(daysUntil("2026-12", "2026-10-02")).toBeNull();
    expect(isPast("2026-09", "2026-10-02")).toBe(true);
    expect(isPast("2026-10", "2026-10-02")).toBe(false);
  });
});

describe("いつ？への答え", () => {
  const base = { kind: "game" as const, key: "x", title: "ゲームX", platforms: ["Switch 2", "PS5"], animeKind: null, storeUrl: null, topics: [], indexable: true };
  it("これから・発売済み・未発表", () => {
    expect(answer({ ...base, date: "2026-10-12" }, "2026-10-02")).toBe("ゲームXは2026年10月12日（月）にSwitch 2・PS5で発売予定です。発売まであと10日です。");
    expect(answer({ ...base, date: "2026-09-01" }, "2026-10-02")).toBe("ゲームXは2026年9月1日（火）にSwitch 2・PS5で発売されました。");
    expect(answer({ ...base, date: null }, "2026-10-02")).toContain("まだ発表されていません");
  });
  it("アニメは放送開始", () => {
    expect(answer({ ...base, kind: "anime", animeKind: "tv", platforms: ["TOKYO MX"], date: "2026-10" }, "2026-10-02")).toBe("ゲームXは2026年10月にTOKYO MXで放送開始予定です。");
  });
});
