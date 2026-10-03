import { describe, expect, it, vi } from "vitest";
import gold from "./fixtures/genre-gold.json";
import holdout from "./fixtures/genre-holdout.json";
import displayed from "./fixtures/genre-displayed.json";
import { confidentMove, judgeGenre } from "@/lib/topics/genre-rules";

vi.mock("@/lib/db", () => ({ prisma: {} }));
const { decideTopicGenre, OVERRIDE_AI_CONFIDENCE, TOPIC_MIN_CONFIDENCE } = await import("@/lib/topics/genre-apply");

/** 本番と同じく、信頼度が足りない判定では今のジャンルのままにする */
const applied = (r: Row) => {
  const j = judgeGenre(r.title, r.summary, r.current, r.publisher || undefined);
  return confidentMove(j, TOPIC_MIN_CONFIDENCE) ? j.genre : r.current;
};

type Row = { id: number; title: string; summary: string | null; publisher: string; current: string; gold: string };
const rows = gold as Row[];

describe("judgeGenre（検証データ）", () => {
  it("人が付けた正解との一致率が 88% 以上（今の分類は 72.7%。残りは AI の見直しで直す）", () => {
    const hit = rows.filter((r) => applied(r) === r.gold).length;
    // 2026-10-02 時点: 220件中 195件（88.6%）。誤って動かさないことを優先し、手がかり1つでは動かさない
    expect(hit / rows.length).toBeGreaterThanOrEqual(0.88);
  });

  it("今のジャンルが正しい話題を動かさない", () => {
    const ok = rows.filter((r) => r.current === r.gold);
    expect(ok.filter((r) => applied(r) !== r.gold).map((r) => r.title)).toEqual([]);
  });

  it("動かした話題は、すべて正解のジャンルに動いている", () => {
    const moved = rows.filter((r) => applied(r) !== r.current);
    expect(moved.filter((r) => applied(r) !== r.gold).map((r) => r.title)).toEqual([]);
  });
});

describe("judgeGenre（本番の試算で誤って動かした例。手がかり1つでは動かさない）", () => {
  const cases: [string, string, string?][] = [
    ["ハニー・ポッターの作者が語る、「女体化ドラコは韓国発」みたいな話があるが", "game"],
    ["セ・リーグ優勝をお祝い！最大20枚無料のラーメンステーション「チャーシュー熱覇増」", "products"],
    ["ASUS、約7年前発売の第8世代～第9世代Intel Core向けZ390/C246マザーボードのBIOSアップデート", "tech"],
    ["「リンツ詰め放題の缶（5980円）に約15000円分詰める方法」を教えてくれる人", "life"],
    ["悪夢は続く…。RAM不足、2028年にかけてさらに悪化する模様", "tech"],
    ["【ドジャース】キム・ヘソン、PS「滑り込み」ロースター入りに期待...「リリーフ", "sports"],
    ["『MUSIC LIFE』×『Motor Magazine』による「クルマと洋楽」", "products"],
    ["久保建英が結婚発表 長友は「アモーレ」で祝福…代表メンバーがから祝福続々", "entertainment", "FOOTBALL ZONE"],
  ];
  it.each(cases)("%s は %s のまま", (title, genre, publisher) => {
    const j = judgeGenre(title, null, genre, publisher);
    expect(confidentMove(j, TOPIC_MIN_CONFIDENCE)).toBe(false);
  });
});

describe("judgeGenre（2つ目の検証データ：AI が未判定の新しい話題 73件）", () => {
  const hold = holdout as Row[];
  it("一致率が 82% 以上（ルールの見直し前は 76.7%）。正しいジャンルを動かさない", () => {
    // 2026-10-02 に正解を付けた。このデータでも語を足したため、次回は別の新しい話題で測る
    expect(hold.filter((r) => applied(r) === r.gold).length / hold.length).toBeGreaterThanOrEqual(0.82);
    expect(hold.filter((r) => r.current === r.gold && applied(r) !== r.gold).map((r) => r.title)).toEqual([]);
  });

  it("人名の中の1文字（久保建英の「英」）や「中国製」で国際にしない", () => {
    expect(judgeGenre("福原遥がサッカー久保建英と電撃婚", null, "entertainment").genre).not.toBe("world");
    expect(confidentMove(judgeGenre("中国製スマートグラスがリコール", null, "tech"), TOPIC_MIN_CONFIDENCE)).toBe(false);
  });
});

describe("judgeGenre（3つ目の検証データ：2026-10-03 朝に各ジャンルの一覧に出ていた話題 142件）", () => {
  const rows3 = displayed as Row[];
  it("一致率が 92% 以上（測定時の表示は 89.4%。ルールだけで 132/142）", () => {
    expect(rows3.filter((r) => applied(r) === r.gold).length / rows3.length).toBeGreaterThanOrEqual(0.92);
  });
  it("フィギュアスケートの話題を新商品にしない・食品の試飲を新商品にする", () => {
    expect(judgeGenre("【フィギュア】島田麻央がサンリオ社とスポンサー契約締結", null, "sports").genre).toBe("sports");
    expect(judgeGenre("期間限定「よくばりプレート」登場、試食レビュー", null, "tech").genre).toBe("products");
    expect(judgeGenre("平日9時に衝撃…フィギュア中井亜美、アクセル決めて81.29点！", null, "sports").genre).toBe("sports");
    expect(judgeGenre("timelesz猪俣周杜さん、契約解除でグループ脱退", "傷害容疑で逮捕された猪俣周杜さんについて、所属事務所は契約を解除したと発表した。", "entertainment").genre).toBe("entertainment");
    expect(judgeGenre("日本各地の“ケンミン熱愛グルメ”が大阪に集結！", null, "products").genre).toBe("products");
    expect(judgeGenre("App Store／Google Play向けアプリゲーム 祝！「キングダム 覇道」", null, "products").genre).toBe("game");
  });
  it("出版社と漫画の媒体の話題は anime、内定式は business（配信元が社会でも）", () => {
    const manga = judgeGenre("集英社「少年ジャンプ＋」林士平氏との業務委託関係をすべて終了", null, "domestic");
    expect(confidentMove(manga, 0.4) ? manga.genre : "domestic").toBe("anime");
    const hr = judgeGenre("TDK、「ポルシェ・エクスペリエンスセンター東京」で2027年入社内定式 齋藤昇社長があいさつ", null, "domestic");
    expect(confidentMove(hr, 0.4) ? hr.genre : "domestic").toBe("business");
  });
});

describe("judgeGenre（指摘された例）", () => {
  it("経済誌が報じた芸能人の話題は entertainment", () => {
    const j = judgeGenre("人気女優が結婚を発表 所属事務所がコメント", "俳優の〇〇さんが結婚したことを所属事務所が発表した。", "business", "東洋経済オンライン");
    expect(j.genre).toBe("entertainment");
    expect(j.moved).toBe(true);
  });

  it("キャラクターグッズの発売は products（tech・game にしない）", () => {
    expect(judgeGenre("サンリオの限定グッズを配布 ローソンでキャンペーン", null, "tech").genre).toBe("products");
  });

  it("スポーツ選手の結婚は entertainment", () => {
    expect(judgeGenre("久保建英選手と福原遥さんが結婚を発表", null, "sports").genre).toBe("entertainment");
  });

  it("手がかりがなければ配信元のジャンルのまま、信頼度 0", () => {
    const j = judgeGenre("きょうのできごと", null, "domestic");
    expect(j).toMatchObject({ genre: "domestic", moved: false });
  });

  it("判定の根拠（効いた語）を返す", () => {
    expect(judgeGenre("人気女優が結婚を発表", null, "business").reason).toContain("女優");
  });
});

describe("decideTopicGenre", () => {
  const base = { id: 1, summary: null, publisher: null, note: null };

  it("AI がまだ見ていない話題は、ルールのジャンルにして記録を残す", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表 所属事務所がコメント", genreSlug: "business", aiGenreSlug: null });
    expect(d.genre).toBe("entertainment");
    expect(d.recheck).toBe(false);
    expect(d.note).toMatch(/^rule entertainment conf=/);
  });

  it("AI の判定とルールが一致すれば、そのまま", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表", genreSlug: "entertainment", aiGenreSlug: "entertainment" });
    expect(d).toMatchObject({ genre: "entertainment", recheck: false });
  });

  it("ルールが AI と強く食い違えば、AI にもう一度だけ見てもらう", () => {
    const title = "人気女優が結婚を発表 所属事務所がコメント";
    const j = judgeGenre(title, null, "business");
    expect(j.confidence).toBeGreaterThanOrEqual(OVERRIDE_AI_CONFIDENCE);
    const d = decideTopicGenre({ ...base, title, genreSlug: "business", aiGenreSlug: "business" });
    expect(d).toMatchObject({ genre: "entertainment", recheck: true });
    expect(d.note).toMatch(/^recheck ai=business /);
  });

  it("見直し待ちの間は動かさない", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表", genreSlug: "entertainment", aiGenreSlug: null, note: "recheck ai=business entertainment conf=0.8" });
    expect(d).toEqual({ genre: "entertainment", note: null, recheck: false });
  });

  it("見直した AI の判定（ai-final）は、ルールで変えない（行ったり来たりしない）", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表 所属事務所がコメント", genreSlug: "business", aiGenreSlug: "business", note: "ai-final business conf=0.9 企業の経営の話題" });
    expect(d).toEqual({ genre: "business", note: null, recheck: false });
  });

  it("AI の記録は、ルールの記録で上書きしない", () => {
    const d = decideTopicGenre({ ...base, title: "人気女優が結婚を発表", genreSlug: "entertainment", aiGenreSlug: "entertainment", note: "ai entertainment conf=0.9 俳優の結婚" });
    expect(d.note).toBeNull();
  });
});
