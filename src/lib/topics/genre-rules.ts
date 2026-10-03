/**
 * 記事単位のジャンル判定（ルール層）。配信元のジャンル（フィードのジャンル）とは別に、見出しと要約の語・固有名詞から判定する。
 * - 語ごとに重みを持ち、見出しは2倍、要約は1倍で数える
 * - 配信元のジャンルは「事前の見込み」として少しだけ足す（語の手がかりがなければ配信元のジャンルになる）
 * - 判定の根拠（効いた語）と信頼度を返し、記録に残す
 * 外部サービスは使わない（無料）。曖昧なもの（信頼度が低いもの）は、AI の見直し（genre-check）に回す
 */

export const GENRES = ["domestic", "world", "business", "tech", "entertainment", "sports", "game", "anime", "products", "life"] as const;
export type GenreSlug = (typeof GENRES)[number];

type Rule = { genre: GenreSlug; re: RegExp; w: number };

const r = (genre: GenreSlug, w: number, words: string) => ({ genre, w, re: new RegExp(words, "g") });

/** 語の手がかり。重みは「その語が出たら、そのジャンルである見込みの強さ」 */
const RULES: Rule[] = [
  // 芸能
  r("entertainment", 2, "声優"),
  r("entertainment", 3, "俳優|女優|タレント|アイドル|歌手|芸人|お笑い|お笑いコンビ|朝ドラ|大河ドラマ|主演|共演|芸能|芸能界|芸能事務所|所属事務所|バラエティ|ミュージシャン|ボーカル|ギタリスト|バンド|作曲家|作詞家|脚本家|映画監督|舞台あいさつ|紅白|グラビア|ジャニーズ|STARTO|Vライバー|VTuber|ライブ配信者"),
  // グループ名だけで報じられる芸能の話題（例：「timelesz猪俣周杜さん…」）
  r("entertainment", 3, "timelesz|SixTONES|Snow Man|なにわ男子|King & Prince|乃木坂46|櫻坂46|日向坂46|AKB48|NMB48|HKT48|BTS|TWICE"),
  r("entertainment", 2, "ドラマ|番組|出演|映画|舞台|MV|アルバム|シングル|ライブ|コンサート|ツアー|ミヤネ屋|ドキュメンタリー|朝ドラ|ブラッサム|ランキングを公開|AWA|インタビュー|熱愛発覚|熱愛報道|不倫|結婚を発表|離婚|卒業を発表|引退を発表|解散を発表|契約解除|脱退|逝去|死去|訃報|追悼"),
  // スポーツ
  r("sports", 3, "プロ野球|大リーグ|MLB|Jリーグ|J1|J2|プレミアリーグ|ラ・リーガ|ブンデス|セリエA|チャンピオンズリーグ|なでしこ|侍ジャパン|サッカー|野球|ラグビー|バスケットボール|Bリーグ|バレーボール|テニス|ゴルフ|ボクシング|プロレス|柔道|レスリング|相撲|横綱|大関|競馬|競輪|競艇|ボートレース|五輪|オリンピック|アジア大会|W杯|ワールドカップ|ネーションズリーグ"),
  r("sports", 3, "錦織|大谷翔平|ラスト公式戦"),
  r("sports", 2, "公式戦|選手|監督|球団|試合|勝利|敗戦|引き分け|アウェー|優勝|連覇|本塁打|打点|投手|先発|ゴール|得点|PK戦|代表|移籍|戦力外|ドラフト|ドラ1|来季契約|金メダル|銀メダル|銅メダル|リーグ戦|開幕|引退試合"),
  // ゲーム
  r("game", 3, "ゲーム|無双|Remastered|リマスター|TGS|東京ゲームショウ|アソビストア|SEGA STORE|Steam|PS5|PS4|プレイステーション|Nintendo Switch|Switch 2|ニンテンドー|Xbox|eスポーツ|DLC|体験版|Mod|ゲーム機|オータムセール|ドラクエ|ドラガク|ポケポケ|モンハン|ファイナルファンタジー|FF\\d|RPG|ローグライク"),
  r("game", 2, "任天堂|セガ|カプコン|スクウェア・エニックス|バンダイナムコ|コナミ|発売日決定|アップデート|攻略|ガチャ"),
  // アニメ・漫画
  r("anime", 2, "声優"),
  r("anime", 3, "アニメ|TVアニメ|劇場版|漫画|マンガ|コミック|少年ジャンプ|ジャンプ＋|連載|原作|コミカライズ|秋アニメ|ガンダム|宇宙戦艦ヤマト|マジンガーZ|エヴァンゲリオン|ちいかわ|進撃の巨人|ジョジョ|ドラえもん|ムビチケ|描き下ろし|劇場アニメ"),
  // 出版社・漫画家の話題（編集者の契約・連載の終了など）
  r("anime", 2, "集英社|講談社|小学館|漫画家|週刊少年|漫画誌|マンガ誌"),
  // 新商品・グルメ
  r("products", 3, "グッズ|新商品|新発売|新メニュー|期間限定|数量限定|限定発売|限定販売|配布|当りくじ|一番くじ|コラボカフェ|コラボグッズ|フィギュア|プラキット|ぬいぐるみ|スイーツ|モンブラン|フラペチーノ|特別仕様車|コレクション|バレエシューズ|パンプス|ノベルティ|サンリオ|ハローキティ|クロミ|ポムポムプリン|シナモロール"),
  // 食品・飲料（技術系の媒体が新商品の試食・試飲を載せることがあるため、語を厚くする）
  r("products", 3, "試食|試飲|新登場|新フレーバー|カップヌードル|ビール|アイスの実|クッキー|おにぎり|おむすび|寿司|ドリンク|ラテ|マフィン|ポップアップストア|立体化|スケールワールド|アクスタ|アクリルスタンド"),
  r("products", 2, "ヘッドセット|イヤフォン|イヤホン|充電器|プリアンプ|特別カラー"),
  r("products", 1, "発売|販売開始|予約開始|新作|コラボ|オープン|ストア|ショップ"),
  // IT・科学
  r("tech", 3, "生成AI|AI|人工知能|ChatGPT|Gemini|LLM|半導体|スマホ|スマートフォン|iPhone|Android|Windows|macOS|Kindle|Xperia|Pixel|アプリ|チャットボット|サイバー|サーバー|クラウド|ソフトウェア|オープンソース|NVIDIA|GPU|CPU|量子|ロケット|宇宙開発|宇宙飛行士|JAXA|NASA|新材料|研究チーム|eSIM|マイナンバーカード"),
  // 企業の情報漏えい・不正アクセスは社会の事件として報じられることが多いため、弱い手がかりにとどめる
  r("tech", 1, "不正アクセス|情報漏えい|情報漏洩"),
  r("tech", 3, "タブレット|Galaxy|キーボード|ノートPC|ノートパソコン|ルーター|SSD"),
  r("tech", 2, "ハッキング|スマートグラス|ウェアラブル|AIエージェント"),
  r("tech", 2, "Google|Microsoft|Apple|Meta|OpenAI|ネット|メール|システム|デジタル|開発ツール|自動運転|モバイル|公式アカウント"),
  r("tech", 1, "Amazon|アマゾン|ソニー|パナソニック|SNS|データ"),
  // 経済
  r("business", 3, "決算|業績|株価|日経平均|為替|円安|円高|利上げ|利下げ|金利|雇用統計|上場|買収|事業譲渡|民事再生|経営破綻|業務停止命令|金融庁|日銀|年収|給料|賃上げ|NISA|投資|資金調達|M&A|子会社化|グループ会社化|内定式|入社式|新卒採用|内定者"),
  r("business", 2, "経営|CEO|売上|利益|人事|上司|部下|職場|転職|リーダー|経済|産業|業界|銀行|証券|生命保険|出店|販売休止|コンサルティング|地頭"),
  r("business", 1, "企業|社長|会社|事業|市場"),
  // 国際
  r("world", 3, "大統領|米国|アメリカ|米政府|中国(?!製)|中国外務省|韓国|北朝鮮|ロシア|プーチン|ウクライナ|イスラエル|ガザ|イラン|英国|英空軍|MI5|フランス|ドイツ|EU|国連|NATO|G7|G20"),
  r("world", 2, "州の|州で|州知事"),
  // 1文字の「米」「英」は人名（久保建英など）にも含まれるため、語の形でだけ数える
  r("world", 1, "米軍|米中|日米|米大統領|訪米|英首相|英政府|仏大統領|仏政府|海外"),
  r("world", 3, "マクロン|トランプ|習近平|ゼレンスキー|メルツ|スターマー"),
  // 国内（社会・政治・事件）
  r("domestic", 3, "逮捕|容疑者|容疑で|書類送検|警視庁|県警|府警|地裁|高裁|最高裁|被告|判決|事件|事故|火災|死亡|重体|重軽傷|首相|官房長官|国会|衆院|参院|自民|立憲|維新|公明|政府|知事|市長|総務相|農水相|厚労省|国交省|文科省|気象庁|地震|大雨|台風"),
  r("domestic", 2, "警察|政権|政治|選挙|行政|自治体|学校|中学校|高校|教育委員会|国勢調査|人口減少"),
  // 暮らし
  r("life", 3, "占い|運勢|開運|星座|心理テスト|収納|洗濯|布団|掃除|節約|家事|子育て|熱中症|健康|慢性炎症|医師が解説|睡眠|仮眠|ダイエット|レシピ|料理|公衆電話|ライフハック|退職代行|配送料|手数料が0円|イラスト|中学受験|高校受験|中学入試|時差ボケ|体内時計"),
  r("life", 2, "暮らし|生活|習慣|快適|便利|おすすめ|鉄道|列車|臨時列車|観光|旅行|天気"),
];

/**
 * ほかのジャンルの語を打ち消す組み合わせ。
 * 例：「選手」と「結婚を発表」が両方あれば、話題の中心は人の私生活なので芸能に寄せる（スポーツ選手の結婚）
 */
const BOOSTS: { when: RegExp; genre: GenreSlug; w: number }[] = [
  { when: /選手.*(結婚|熱愛発覚|離婚)|(結婚|熱愛発覚|離婚).*選手/, genre: "entertainment", w: 4 },
  // 結婚・熱愛・離婚の発表は、スポーツ選手でも話題の中心は私生活（例：「久保建英が結婚発表」）
  // 芸能人の逮捕・契約解除・グループ脱退は、事件の語があっても芸能の話題（例：「timelesz猪俣周杜さん、契約解除でグループ脱退」）
  { when: /グループ(を)?脱退|契約解除|活動(を)?休止|所属事務所|芸能活動/, genre: "entertainment", w: 8 },
  // 「熱愛グルメ」のような言い回しもあるため、熱愛は「発覚・報道」の形だけ
  { when: /電撃婚|結婚.{0,4}発表|結婚報告|熱愛(発覚|報道)|離婚.{0,4}発表|交際(を)?宣言/, genre: "entertainment", w: 8 },
  { when: /(グッズ|配布|発売).*(サンリオ|ポケモン|ちいかわ|キャラクター)|(サンリオ|ポケモン|ちいかわ|キャラクター).*(グッズ|配布|発売)/, genre: "products", w: 4 },
  // 「フィギュア」はフィギュアスケートのこともある（【フィギュア】島田麻央…）
  { when: /フィギュアスケート|【フィギュア】|フィギュア.{0,2}(選手|女子|男子|GP|グランプリ)|フィギュア.{0,12}(アクセル|演技|ショート|フリー|ジャンプ|\d+\.\d+点)/, genre: "sports", w: 16 },
  // スマホのゲームは、「アプリ」の語があっても IT ではなくゲーム
  { when: /アプリゲーム|スマホゲーム|ソシャゲ|基本無料ゲーム/, genre: "game", w: 8 },
  // アニメのキャラクターでも、グッズ・特別カラーの商品の話題は新商品（作品の話題ではない）
  { when: /グッズ|特別カラー|フィギュア/, genre: "products", w: 3 },
];

/** 配信元（媒体名）から分かる手がかり。媒体が1つのジャンルに特化しているとき */
const PUBLISHER_HINTS: { re: RegExp; genre: GenreSlug; w: number }[] = [
  { re: /少年ジャンプ|ジャンプ＋|コミックナタリー|アニメ！アニメ！/, genre: "anime", w: 4 },
  { re: /ライフハッカー/, genre: "life", w: 3 },
  { re: /ゲキサカ|サッカーキング|FOOTBALL ZONE|Full-Count|BASEBALL KING|バスケットボールキング|THE ANSWER/, genre: "sports", w: 3 },
  { re: /4Gamer|Game\*Spark|AUTOMATON|IGN Japan|GAME Watch/, genre: "game", w: 3 },
];

/** 配信元のジャンルに足す見込み（語の手がかりが弱いときに、配信元のジャンルのままにするため） */
const FEED_PRIOR = 2.5;

export type GenreJudgement = {
  genre: GenreSlug;
  /** 0〜1。1位と2位の差の大きさ（語の手がかりが少ない・拮抗しているほど低い） */
  confidence: number;
  /** 判定の根拠（効いた語と点数） */
  reason: string;
  /** 配信元のジャンルから変えたか */
  moved: boolean;
  /** 1位のジャンルに効いた手がかり（語・媒体・組み合わせ）の数。1つの語だけで動かさないために使う */
  evidence: number;
};

/**
 * 配信元のジャンルから変えてよいか。手がかりが1つだけ（例：「韓国」「優勝」「攻略」）では、よほど差がない限り動かさない。
 * 実データでの試算（2026-10-02、48時間・3000話題）で、1語だけの判定は誤りが多かったため
 */
export function confidentMove(j: GenreJudgement, minConfidence = 0.5): boolean {
  return j.moved && ((j.evidence >= 2 && j.confidence >= minConfidence) || j.confidence >= 0.75);
}

function count(re: RegExp, text: string): string[] {
  re.lastIndex = 0;
  return text.match(re) ?? [];
}

/** 記事（または話題）のジャンルを判定する */
export function judgeGenre(title: string, summary: string | null | undefined, feedGenre: string, publisher?: string): GenreJudgement {
  const score = new Map<GenreSlug, number>();
  const hits = new Map<GenreSlug, string[]>();
  const add = (g: GenreSlug, w: number, word?: string) => {
    score.set(g, (score.get(g) ?? 0) + w);
    if (word) hits.set(g, [...(hits.get(g) ?? []), word]);
  };
  const body = (summary ?? "").slice(0, 160);
  for (const rule of RULES) {
    // 同じ語は1回だけ数える（同じ語の繰り返しで点が膨らまないように）
    for (const w of new Set(count(rule.re, title))) add(rule.genre, rule.w * 2, w);
    for (const w of new Set(count(rule.re, body))) if (!count(rule.re, title).includes(w)) add(rule.genre, rule.w, w);
  }
  const text = `${title} ${body}`;
  if (publisher) for (const h of PUBLISHER_HINTS) if (h.re.test(publisher)) add(h.genre, h.w, `媒体:${publisher}`);
  for (const b of BOOSTS) if (b.when.test(text)) add(b.genre, b.w, `組み合わせ:${b.genre}`);
  if ((GENRES as readonly string[]).includes(feedGenre)) add(feedGenre as GenreSlug, FEED_PRIOR);

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { genre: (feedGenre as GenreSlug) ?? "domestic", confidence: 0, reason: "手がかりなし", moved: false, evidence: 0 };
  const [top, second] = ranked;
  const confidence = Math.max(0, Math.min(1, (top[1] - (second?.[1] ?? 0)) / Math.max(top[1], 1)));
  const reason = ranked
    .slice(0, 3)
    .map(([g, s]) => `${g}:${s}${hits.get(g)?.length ? `(${[...new Set(hits.get(g))].slice(0, 4).join("・")})` : ""}`)
    .join(" ");
  return {
    genre: top[0],
    confidence: Math.round(confidence * 100) / 100,
    reason,
    moved: top[0] !== feedGenre,
    evidence: new Set(hits.get(top[0]) ?? []).size,
  };
}
