import { describe, expect, it } from "vitest";
import { COUNTRIES, countTags, findTag, groupTagCounts, matchesTag, TEAMS } from "@/lib/tags";

describe("matchesTag", () => {
  it("言い換えも拾い、別の意味の言葉は除く", () => {
    const china = findTag("country", "china")!;
    expect(matchesTag(china, "習近平国家主席が訪問")).toBe(true);
    expect(matchesTag(china, "中国地方で大雨")).toBe(false);
    const us = findTag("country", "us")!;
    expect(matchesTag(us, "日米首脳が会談")).toBe(true);
    const carp = findTag("team", "carp")!;
    expect(matchesTag(carp, "広島が逆転勝ち")).toBe(true);
    expect(matchesTag(carp, "サンフレッチェ広島が首位")).toBe(false);
    expect(matchesTag(findTag("team", "baystars")!, "ＤｅＮＡが連勝")).toBe(true);
  });
  it("インドネシアはインドに入れない", () => {
    expect(matchesTag(findTag("country", "india")!, "インドネシアで地震")).toBe(false);
  });
});

describe("countTags", () => {
  it("話題の多い順に、0件を除いて返す", () => {
    const out = countTags(TEAMS, ["阪神が勝利", "阪神・佐藤が本塁打", "巨人が敗れる", "天気"]);
    expect(out.map((x) => [x.tag.slug, x.count])).toEqual([
      ["tigers", 2],
      ["giants", 1],
    ]);
  });
  it("slug は重複しない", () => {
    for (const list of [COUNTRIES, TEAMS]) expect(new Set(list.map((t) => t.slug)).size).toBe(list.length);
  });
});

describe("groupTagCounts", () => {
  it("競技・地域ごとに分け、まとまりは定義の順、中は数えた順のまま", () => {
    const counts = countTags(TEAMS, ["巨人が勝利", "巨人また勝利", "ドジャース大谷", "森保ジャパン招集", "阪神が連勝"]);
    const groups = groupTagCounts(counts);
    expect(groups.map((g) => g.group)).toEqual(["プロ野球", "大リーグ", "日本代表"]);
    expect(groups[0]).toMatchObject({ total: 3, items: [{ tag: { name: "巨人" }, count: 2 }, { tag: { name: "阪神" }, count: 1 }] });
  });
  it("すべての国・チームが、どこかのまとまりに入っている", () => {
    for (const t of [...COUNTRIES, ...TEAMS]) expect(t.group).toBeTruthy();
    expect(new Set(COUNTRIES.map((t) => t.group))).toEqual(new Set(["北米", "アジア", "ヨーロッパ", "中東"]));
  });
});

describe("海外サッカー", () => {
  const find = (slug: string) => TEAMS.find((t) => t.slug === slug)!;
  it("リーグ名と主なクラブの名前で見分ける", () => {
    expect(matchesTag(find("premier-league"), "リバプール、アーセナルに競り勝つ")).toBe(true);
    expect(matchesTag(find("la-liga"), "レアル・ソシエダの久保が先制点")).toBe(true);
    expect(matchesTag(find("bundesliga"), "バイエルンが首位を守る")).toBe(true);
    expect(matchesTag(find("serie-a"), "インテルがナポリに勝利")).toBe(true);
    expect(matchesTag(find("ligue-1"), "パリSGが3連勝")).toBe(true);
    expect(matchesTag(find("ucl"), "欧州CL、アーセナルが快勝")).toBe(true);
  });
  it("別のものは拾わない", () => {
    expect(matchesTag(find("serie-a"), "インテル・マイアミのメッシが2得点")).toBe(false);
    expect(matchesTag(find("ligue-1"), "F1モナコGPで角田が入賞")).toBe(false);
    expect(matchesTag(find("ucl"), "ACL、川崎Fがアジア王者に")).toBe(false);
    expect(matchesTag(find("premier-league"), "プレミアムモルツ新発売")).toBe(false);
  });
  it("海外サッカーのまとまりに入る", () => {
    expect(find("premier-league").group).toBe("海外サッカー");
  });
});
