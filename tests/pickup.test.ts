import { describe, expect, it, vi } from "vitest";

// 投稿文の組み立てだけを確かめる（DB には接続しない）
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { breakingPostText, pickupPostText } from "@/lib/digest/breaking";
import { altText, buildBreakingCard, BREAKING_COLOR, PICKUP_COLOR, type EditionEntry } from "@/lib/digest/compose";
import { editionKey, isSingleSlot } from "@/lib/digest/slots";

const entry: EditionEntry = {
  position: 1,
  role: "MAIN",
  category: "ECONOMY",
  headline: ["日本トイザらスが", "民事再生を申請"],
  shortTitle: "日本トイザらスが民事再生を申請",
  keyword: "トイザらス",
  points: [{ text: "負債は約300億円", sources: [1] }],
  why: null,
  delta: null,
  publishers: ["時事ドットコム", "日本経済新聞"],
  firstSeenAt: new Date("2026-10-02T00:00:00Z"),
} as EditionEntry;

describe("注目のニュース（速報の表示なし）", () => {
  it("カードの札は「注目」で、速報とは言わない", () => {
    const card = buildBreakingCard(entry, new Date("2026-10-03T09:00:00Z"), null, "PICKUP");
    expect(card.label).toBe("注目");
    expect(card.color).toBe(PICKUP_COLOR);
    expect(altText(card)).toMatch(/^［注目 /);
    expect(altText(card)).not.toContain("速報");
  });
  it("速報のカードはこれまでどおり", () => {
    const card = buildBreakingCard(entry, new Date("2026-10-03T09:00:00Z"), null);
    expect(card.label).toBe("速報");
    expect(card.color).toBe(BREAKING_COLOR);
  });
  it("投稿文に「速報」を入れない", () => {
    expect(pickupPostText(entry.headline).join("\n")).not.toContain("速報");
    expect(breakingPostText(entry.headline, new Date()).join("\n")).toContain("速報");
  });
  it("1本だけの回として扱い、出来事ごとに鍵を分ける", () => {
    expect(isSingleSlot("PICKUP")).toBe(true);
    expect(isSingleSlot("LUNCH")).toBe(false);
    expect(editionKey("2026-10-03", "PICKUP", "s1")).toBe("2026-10-03:PICKUP:s1");
    expect(editionKey("2026-10-03", "BREAKING", "s1")).toBe("2026-10-03:BREAKING:s1");
  });
});

describe("AI 解析前の見出しの下書き", () => {
  it("句読点の切れ目で12字×2行に詰め、媒体の飾りを外す", async () => {
    const { draftHeadline } = await import("@/lib/digest/breaking");
    const { textWidth } = await import("@/lib/stories/text");
    const h = draftHeadline({ title: "【速報】久保建英、薬指に指輪キラリ！ 幸せ結婚発表から一夜明け…日本代表の練習に登場", aiTitle: null });
    expect(h.length).toBeLessThanOrEqual(2);
    expect(h[0].startsWith("久保建英")).toBe(true);
    for (const l of h) expect(textWidth(l)).toBeLessThanOrEqual(12);
  });
  it("AI の見出しがあれば、それを使う", async () => {
    const { draftHeadline } = await import("@/lib/digest/breaking");
    expect(draftHeadline({ title: "長い元の見出し…", aiTitle: "マンチェスターC告発者、証人保護の打ち切り報道" }).join("")).toContain("マンチェスターC告発者");
  });
});
