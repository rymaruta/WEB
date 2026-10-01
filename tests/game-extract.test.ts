import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { isGameReleaseCandidate } = await import("@/lib/game-extract");

describe("isGameReleaseCandidate", () => {
  it("ゲーム本体の発売・延期の記事を候補にする", () => {
    for (const t of [
      "「Kena: コスモラの刻印」，発売時期を2027年に延期",
      "「キン肉マン マッスルタッグマッチ 令和復活編」，スマホ向けに今秋発売",
      "『エースコンバット8』明日10月2日に正式発売",
      "死と隣り合わせの恋愛ADV「Sullyland Nursery Rhyme」，本日発売",
      "パーティゲーム「えかきうた大合戦」，10月1日に早期アクセス版をリリース",
    ]) {
      expect(isGameReleaseCandidate(t), t).toBe(true);
    }
  });

  it("グッズ・くじ・体験版・食べ物などは候補にしない", () => {
    for (const t of [
      "『ゼルダの伝説』オリジナル商品がアニメイトで発売！アクスタやアクセサリー",
      "『Castlevania: Belmont’s Curse』体験版配信開始！",
      "ハロウィン衣装のディズニーキャラが大集合！ Happyくじが10月発売",
      "バーガーキングに「ダブルビーフ&ベーコン」など2種が10月2日に新発売",
      "ガシャポン「学園アイドルマスター」が10月発売",
    ]) {
      expect(isGameReleaseCandidate(t), t).toBe(false);
    }
  });

  it("日付のない記事は候補にしない", () => {
    expect(isGameReleaseCandidate("新作RPGの発売が決定")).toBe(false);
  });
});
