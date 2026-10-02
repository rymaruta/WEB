import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { parseYouTubeFeed, verifySummary } = await import("@/lib/youtube");
const { viewsLabel } = await import("@/lib/youtube-channels");

const feed = `<feed><entry>
  <yt:videoId>LBofnBciP0E</yt:videoId>
  <yt:channelId>UCgMPP6RRjktV7krOfyUewqw</yt:channelId>
  <title>【検証】ゲームなら寝ずに無限にできる説。</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=LBofnBciP0E"/>
  <published>2026-09-30T08:00:16+00:00</published>
  <media:group><media:description>24時間ゲームを続けてみました &amp; 結果は…</media:description>
  <media:community><media:statistics views="1234567"/></media:community></media:group>
</entry><entry>
  <yt:videoId>pHwzMIP-deM</yt:videoId>
  <yt:channelId>UCgMPP6RRjktV7krOfyUewqw</yt:channelId>
  <title>ショート</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/pHwzMIP-deM"/>
  <published>2026-10-01T08:37:13+00:00</published>
  <media:group><media:description></media:description><media:community><media:statistics views="83173"/></media:community></media:group>
</entry></feed>`;

describe("parseYouTubeFeed", () => {
  it("題名・説明文・再生回数・ショートかどうかを読む", () => {
    const [a, b] = parseYouTubeFeed(feed);
    expect(a).toMatchObject({ videoId: "LBofnBciP0E", title: "【検証】ゲームなら寝ずに無限にできる説。", description: "24時間ゲームを続けてみました & 結果は…", views: 1234567, isShort: false });
    expect(a.thumbnail).toBe("https://i.ytimg.com/vi/LBofnBciP0E/hqdefault.jpg");
    expect(b).toMatchObject({ videoId: "pHwzMIP-deM", isShort: true, views: 83173 });
  });
});

describe("verifySummary", () => {
  const src = { title: "【検証】ゲームなら寝ずに無限にできる説。", description: "24時間ゲームを続けてみました", publishedAt: new Date("2026-09-30T08:00:00Z") };
  it("題名と説明文にある事実だけなら残す", () => {
    expect(verifySummary("寝ずにゲームを24時間続けられるかを検証する企画です。", src)).toBe("寝ずにゲームを24時間続けられるかを検証する企画です。");
  });
  it("書かれていない数字・煽り・長すぎる文は使わない", () => {
    expect(verifySummary("48時間ゲームを続ける企画です。", src)).toBeNull();
    expect(verifySummary("衝撃の結末が待っています。", src)).toBeNull();
    expect(verifySummary("あ".repeat(201), src)).toBeNull();
    expect(verifySummary(null, src)).toBeNull();
  });
});

describe("viewsLabel", () => {
  it("回数の表示", () => {
    expect(viewsLabel(1234)).toBe("1,234回");
    expect(viewsLabel(1234567)).toBe("123.5万回");
    expect(viewsLabel(250_000_000)).toBe("2.5億回");
  });
});
