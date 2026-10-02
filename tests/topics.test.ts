import { describe, expect, it } from "vitest";
import { assignTopics, type ClusterDoc } from "@/lib/topics/assign";
import { topicScore } from "@/lib/topics/score";
import { bigrams, normalizeForMatch } from "@/lib/topics/similarity";

const at = (h: number) => new Date(Date.UTC(2026, 8, 30, h));
let seq = 0;
const doc = (title: string, publisher: string, h = 0, topicId: number | null = null): ClusterDoc => ({
  id: ++seq,
  title,
  publisher,
  publishedAt: at(h),
  topicId,
});

// 実運用に近い IDF にするため、無関係な記事を混ぜる
const background = [
  "政府が新たな経済対策を閣議決定 総額10兆円規模",
  "東京株式市場 日経平均株価が続落 半導体関連に売り",
  "新作スマートフォンの予約受付が開始 価格は据え置き",
  "台風が接近 週末は大雨に警戒を",
  "人気アニメの劇場版 来夏公開決定",
  "Jリーグ 首位攻防戦は引き分け",
  "新型ゲーム機の販売台数が100万台突破",
  "大手コンビニが秋の新作スイーツを発売",
].map((t, i) => doc(t, `bg${i}`));

describe("normalizeForMatch / bigrams", () => {
  it("全角英数・先頭の配信元表記・ノイズ語を正規化する", () => {
    expect(normalizeForMatch("[ITmedia News] 【速報】ＡＩ規制")).toBe("ai規制");
    expect(bigrams("ＡＩ規制")).toEqual(["ai", "i規", "規制"]);
  });
});

describe("assignTopics", () => {
  it("別媒体の同じ出来事の見出しを1つのトピックにまとめる", () => {
    const docs = [
      ...background,
      doc("オリックス、野上士耀選手が急逝…25年ドラフト7位入団", "A", 1),
      doc("オリックスの野上士耀さんが19歳で急逝 前日は全体練習後に居残り練習", "B", 2),
      doc("野上士耀選手が死去、１９歳 寮の室内で発見―プロ野球・オリックス", "C", 3),
    ];
    const result = assignTopics(docs);
    const keys = docs.slice(-3).map((d) => result.get(d.id));
    expect(new Set(keys).size).toBe(1);
  });

  it("同じ媒体の定型見出しは束ねない", () => {
    const docs = [
      ...background,
      doc("福島vs水戸 試合記録", "S", 1),
      doc("福島vs長野 試合記録", "S", 2),
      doc("鳥取vs長崎 試合記録", "S", 3),
      doc("磐田vs千葉 試合記録", "S", 4),
    ];
    const result = assignTopics(docs);
    const keys = docs.slice(-4).map((d) => result.get(d.id));
    expect(new Set(keys).size).toBe(4);
  });

  it("既存トピックへの割り当てを維持し、新着記事を既存トピックに追加する", () => {
    const existing = [
      doc("「Yahoo!きっず」が12月4日にサービス終了 29年の歴史に幕", "A", 1, 42),
      doc("「Yahoo!きっず」，2026年12月4日をもってサービス終了", "B", 2, 42),
    ];
    const incoming = doc("Yahoo!きっず終了発表、29年の歴史に幕", "C", 3);
    const result = assignTopics([...background, ...existing, incoming]);
    expect(result.has(existing[0].id)).toBe(false);
    expect(result.get(incoming.id)).toBe(42);
  });
});

describe("topicScore", () => {
  it("媒体数が多いほど高く、時間経過で減衰する", () => {
    const now = at(12);
    const base = { articleCount: 3, socialCount: 0, clicks: 0, lastSeenAt: at(11) };
    expect(topicScore({ ...base, publisherCount: 3 }, now)).toBeGreaterThan(
      topicScore({ ...base, publisherCount: 1 }, now),
    );
    expect(topicScore({ ...base, publisherCount: 3 }, now)).toBeGreaterThan(
      topicScore({ ...base, publisherCount: 3, lastSeenAt: at(0) }, now),
    );
  });
  it("5媒体が1時間前に報じた出来事は、2媒体が直前に報じた話題より上", () => {
    const now = at(12);
    const big = topicScore({ publisherCount: 5, articleCount: 5, socialCount: 0, clicks: 0, lastSeenAt: at(11) }, now);
    const fresh = topicScore({ publisherCount: 2, articleCount: 2, socialCount: 20, clicks: 0, lastSeenAt: at(12) }, now);
    expect(big).toBeGreaterThan(fresh);
  });
  it("ゲーム・アニメや新商品は、同じ条件なら控えめにする", () => {
    const now = at(12);
    const s = { publisherCount: 3, articleCount: 3, socialCount: 0, clicks: 0, lastSeenAt: at(11) };
    expect(topicScore({ ...s, genreSlug: "game" }, now)).toBeLessThan(topicScore({ ...s, genreSlug: "domestic" }, now));
  });
});

describe("topicScore と報道機関の記事", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const base = { publisherCount: 1, articleCount: 1, socialCount: 300, clicks: 0, lastSeenAt: now };
  it("SNS のまとめ・企業のお知らせだけの話題は、話題順で下に回す", () => {
    expect(topicScore({ ...base, newsArticles: 0 }, now)).toBeLessThan(topicScore({ ...base, newsArticles: 1 }, now) * 0.5);
  });
  it("報道機関の記事の数が分からないときは、これまでどおり", () => {
    expect(topicScore(base, now)).toBe(topicScore({ ...base, newsArticles: 1 }, now));
  });
});
