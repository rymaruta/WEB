import { describe, expect, it } from "vitest";
import { bigWord, hotReason, isHot, worthApi } from "@/lib/stories/hot";

const now = new Date("2026-10-02T13:00:00Z").getTime();
const ago = (min: number) => new Date(now - min * 60_000);

describe("isHot", () => {
  it("1時間以内に4媒体がそろった出来事は速報の候補", () => {
    expect(isHot({ publisherCount: 4, firstSeenAt: ago(40), lastSeenAt: ago(5) }, now)).toBe(true);
  });
  it("4媒体でも、そろうまで1時間以上かかった出来事は候補にしない", () => {
    expect(isHot({ publisherCount: 4, firstSeenAt: ago(150), lastSeenAt: ago(10) }, now)).toBe(false);
  });
  it("3時間以内に5媒体なら候補", () => {
    expect(isHot({ publisherCount: 5, firstSeenAt: ago(170), lastSeenAt: ago(1) }, now)).toBe(true);
  });
  it("大きな出来事の言葉があれば、1媒体でも候補", () => {
    expect(hotReason({ title: "久保建英、女優・福原遥と結婚を発表", publisherCount: 1, firstSeenAt: ago(3) }, now)).toBe("「結婚」");
    expect(isHot({ title: "人気俳優が死去 58歳", publisherCount: 1, firstSeenAt: ago(3) }, now)).toBe(true);
  });
  it("言葉が入っていても、大きな出来事でない言い方は除く", () => {
    expect(bigWord("秋の結婚式場ランキング")).toBeNull();
    expect(bigWord("優勝候補の3チームを比較")).toBeNull();
    expect(isHot({ title: "新しいスマホが発売", publisherCount: 1, firstSeenAt: ago(3) }, now)).toBe(false);
  });
  it("3時間を過ぎた出来事・3媒体以下は候補にしない", () => {
    expect(isHot({ publisherCount: 9, firstSeenAt: ago(200) }, now)).toBe(false);
    expect(isHot({ publisherCount: 3, firstSeenAt: ago(10) }, now)).toBe(false);
  });
});

describe("worthApi", () => {
  it("事件・訃報・政治は API で解析しない（自動では出さないため）", () => {
    expect(worthApi("俳優の◯◯さん死去", { quiet: false })).toBe(false);
    expect(worthApi("◯◯容疑者を逮捕", { quiet: false })).toBe(false);
    expect(worthApi("久保建英と福原遥が結婚", { quiet: false })).toBe(true);
  });
  it("深夜は災害だけ", () => {
    expect(worthApi("久保建英と福原遥が結婚", { quiet: true })).toBe(false);
    expect(worthApi("震度6強の地震 津波注意報", { quiet: true })).toBe(true);
  });
});

describe("出来事の報道でない見出しは候補にしない（2026-10-07）", () => {
  const t = (title: string) => hotReason({ title, publisherCount: 1, firstSeenAt: ago(30) }, now);
  it("雑誌のコラム・調査・インタビュー・推測", () => {
    expect(t("｢心配で死に切れん｣宇野千代の実母は1歳の娘を遺して亡くなった…千代が86歳で綴った一文")).toBeNull();
    expect(t("20～50代の女性1000名に聞いた「離婚・再婚に関する調査」を発表")).toBeNull();
    expect(t("福原遥〝突然の海外志向〟は久保建英との結婚見据えた「欧州リサーチ」か")).toBeNull();
    expect(t("【体操】杉原愛子 世界選手権へ弾みつけた２つの金メダル…復帰後の「転機」を大野コーチが証言")).toBeNull();
  });
  it("出来事の報道は今までどおり候補", () => {
    expect(t("DeNA松本隆之介投手が現役引退")).toBe("「引退」");
    expect(t("阪神がセ・リーグ優勝")).toBe("「優勝」");
  });
  it("災害はコラム風の見出しでも候補", () => expect(t("震度6強の地震…各地の被害は")).toBe("「地震」"));
});
