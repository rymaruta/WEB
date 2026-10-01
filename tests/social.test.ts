import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/events", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyOwner: vi.fn() }));
vi.mock("@/lib/digest/publish", () => ({ loadForPublish: vi.fn() }));

const { blueskyCredentialsFromEnv, graphemes, linkFacets } = await import("@/lib/social/bluesky");
const { crossPostText, enabledChannels } = await import("@/lib/digest/crosspost");
const { POST_CTA } = await import("@/lib/digest/compose");
const { THREADS_DAILY, threadsDailyText } = await import("@/lib/digest/threads-daily");
const { threadsConfigured, THREADS_MAX_CHARS } = await import("@/lib/social/threads");

const LINK = "https://zenbu-navi.com/digest/2026-10-01/evening";
const xText = ["🌙 10月1日（水）夜のニュース", "", "・日銀が追加利上げを決定", "・台風10号が上陸", "・新型スマホを発表", "", POST_CTA].join("\n");

describe("crossPostText", () => {
  it("画像への案内を記事へのリンクに替える", () => {
    expect(crossPostText(xText, LINK, 300, graphemes)).toBe(
      ["🌙 10月1日（水）夜のニュース", "", "・日銀が追加利上げを決定", "・台風10号が上陸", "・新型スマホを発表", "", "詳しくはこちら", LINK].join("\n"),
    );
  });

  it("上限を超えるときは、見出しを後ろから減らす", () => {
    const out = crossPostText(xText, LINK, graphemes(crossPostText(xText, LINK, 300, graphemes)) - 5, graphemes);
    expect(out).not.toContain("新型スマホ");
    expect(out).toContain("台風10号");
    expect(out.endsWith(LINK)).toBe(true);
  });
});

describe("linkFacets", () => {
  it("URL の位置を UTF-8 のバイト数で示す", () => {
    const text = `詳しくはこちら\n${LINK}`;
    const [f] = linkFacets(text);
    const bytes = new TextEncoder().encode(text);
    expect(new TextDecoder().decode(bytes.slice(f.index.byteStart, f.index.byteEnd))).toBe(LINK);
    expect(f.features[0].uri).toBe(LINK);
  });
});

describe("設定", () => {
  it("認証情報がなければ、どの配信先も使わない", () => {
    expect(enabledChannels({})).toEqual([]);
    expect(threadsConfigured({})).toBe(false);
    expect(blueskyCredentialsFromEnv({ BLUESKY_HANDLE: "PLACEHOLDER", BLUESKY_APP_PASSWORD: "x" })).toBeNull();
  });

  it("Bluesky の認証情報があれば Bluesky に投稿する", () => {
    expect(enabledChannels({ BLUESKY_HANDLE: "@zenbu-navi.bsky.social", BLUESKY_APP_PASSWORD: "abcd-efgh-ijkl-mnop" })).toEqual(["BLUESKY"]);
    expect(blueskyCredentialsFromEnv({ BLUESKY_HANDLE: "@zenbu-navi.bsky.social", BLUESKY_APP_PASSWORD: "p" })?.handle).toBe("zenbu-navi.bsky.social");
  });
});

describe("threadsDailyText", () => {
  const article = {
    title: "日銀が追加利上げ、政策金利0.75%に",
    points: [{ text: "政策金利を0.5%から0.75%に引き上げた" }, { text: "利上げは今年2回目" }, { text: "住宅ローンの変動金利に影響する可能性がある" }, { text: "4つ目" }],
  };

  it("見出しと要点3つまでを、落ち着いた形で並べる", () => {
    expect(threadsDailyText(article, 12)).toBe(
      [
        "今日いちばん知っておきたいニュース",
        "",
        "日銀が追加利上げ、政策金利0.75%に",
        "",
        "・政策金利を0.5%から0.75%に引き上げた",
        "・利上げは今年2回目",
        "・住宅ローンの変動金利に影響する可能性がある",
        "",
        "12媒体の報道をもとにまとめました",
      ].join("\n"),
    );
  });

  it("上限を超えるときは要点を減らす", () => {
    const long = { title: article.title, points: Array.from({ length: 3 }, () => ({ text: "あ".repeat(200) })) };
    const out = threadsDailyText(long, 3);
    expect([...out].length).toBeLessThanOrEqual(THREADS_MAX_CHARS);
    expect(out.split("\n").filter((l) => l.startsWith("・"))).toHaveLength(2);
  });

  it("事件・訃報は選ばない", () => {
    expect(THREADS_DAILY.excludedRisks).toEqual(["CRIME", "DEATH"]);
  });
});
