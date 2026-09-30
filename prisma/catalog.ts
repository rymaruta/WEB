/**
 * ジャンルと収集対象フィードのマスタ。
 * 追加・削除はこのファイルを編集して `npm run db:seed` を実行する（feedUrl をキーに upsert）。
 * 商用公開前に、各媒体の RSS 利用規約を必ず確認すること（README「掲載メディアの規約確認」参照）。
 */

export type GenreSeed = { slug: string; name: string };

export const genres: GenreSeed[] = [
  { slug: "domestic", name: "国内" },
  { slug: "world", name: "国際" },
  { slug: "business", name: "経済" },
  { slug: "tech", name: "IT・科学" },
  { slug: "entertainment", name: "エンタメ" },
  { slug: "sports", name: "スポーツ" },
  { slug: "game", name: "ゲーム・アニメ" },
  { slug: "products", name: "新商品・グルメ" },
  { slug: "life", name: "ライフ・トレンド" },
];

export type SourceSeed = {
  name: string;
  publisher: string;
  siteUrl: string;
  feedUrl: string;
  genre: string;
  kind?: "NEWS" | "PRESS" | "SOCIAL";
  /** false の場合は収集しない。理由を disabledReason に残す */
  active?: boolean;
  disabledReason?: string;
};

/** 媒体側のボット対策で自動取得が拒否されるフィード。回避はせず、提携・許諾後に有効化する */
const BLOCKED = { active: false, disabledReason: "自動取得を拒否（媒体側のボット対策）。提携・許諾後に有効化" } as const;

export const sources: SourceSeed[] = [
  // 国内
  { name: "文春オンライン", publisher: "文春オンライン", siteUrl: "https://bunshun.jp/", feedUrl: "https://bunshun.jp/list/feed/rss", genre: "domestic" },
  { name: "朝日新聞 主要", publisher: "朝日新聞", siteUrl: "https://www.asahi.com/", feedUrl: "https://www.asahi.com/rss/asahi/newsheadlines.rdf", genre: "domestic", ...BLOCKED },
  { name: "朝日新聞 政治", publisher: "朝日新聞", siteUrl: "https://www.asahi.com/politics/", feedUrl: "https://www.asahi.com/rss/asahi/politics.rdf", genre: "domestic", ...BLOCKED },
  { name: "毎日新聞 速報", publisher: "毎日新聞", siteUrl: "https://mainichi.jp/", feedUrl: "https://mainichi.jp/rss/etc/mainichi-flash.rss", genre: "domestic", ...BLOCKED },
  { name: "TBS NEWS DIG", publisher: "TBS NEWS DIG", siteUrl: "https://newsdig.tbs.co.jp/", feedUrl: "https://newsdig.tbs.co.jp/list/feed/rss", genre: "domestic", ...BLOCKED },
  { name: "日テレNEWS NNN", publisher: "日テレNEWS NNN", siteUrl: "https://news.ntv.co.jp/", feedUrl: "https://news.ntv.co.jp/rss/index.rdf", genre: "domestic", ...BLOCKED },
  { name: "時事ドットコム アクセスランキング", publisher: "時事ドットコム", siteUrl: "https://www.jiji.com/", feedUrl: "https://www.jiji.com/rss/ranking.rdf", genre: "domestic" },
  { name: "ハフポスト日本版", publisher: "ハフポスト日本版", siteUrl: "https://www.huffingtonpost.jp/", feedUrl: "https://www.huffingtonpost.jp/feeds/index.xml", genre: "domestic", ...BLOCKED },
  { name: "J-CASTニュース", publisher: "J-CASTニュース", siteUrl: "https://www.j-cast.com/", feedUrl: "https://www.j-cast.com/index.xml", genre: "domestic" },
  { name: "ライブドアニュース 主要", publisher: "ライブドアニュース", siteUrl: "https://news.livedoor.com/", feedUrl: "https://news.livedoor.com/topics/rss/top.xml", genre: "domestic" },

  // 国際
  { name: "WEDGE ONLINE", publisher: "WEDGE ONLINE", siteUrl: "https://wedge.ismedia.jp/", feedUrl: "https://wedge.ismedia.jp/list/feed/rss", genre: "world" },
  { name: "朝日新聞 国際", publisher: "朝日新聞", siteUrl: "https://www.asahi.com/international/", feedUrl: "https://www.asahi.com/rss/asahi/international.rdf", genre: "world", ...BLOCKED },
  { name: "BBCニュース ジャパン", publisher: "BBCニュース", siteUrl: "https://www.bbc.com/japanese", feedUrl: "https://feeds.bbci.co.uk/japanese/rss.xml", genre: "world" },

  // 経済
  { name: "Business Insider Japan", publisher: "Business Insider Japan", siteUrl: "https://www.businessinsider.jp/", feedUrl: "https://www.businessinsider.jp/feed/index.xml", genre: "business" },
  { name: "東洋経済オンライン", publisher: "東洋経済オンライン", siteUrl: "https://toyokeizai.net/", feedUrl: "https://toyokeizai.net/list/feed/rss", genre: "business" },
  { name: "ダイヤモンド・オンライン", publisher: "ダイヤモンド・オンライン", siteUrl: "https://diamond.jp/", feedUrl: "https://diamond.jp/list/feed/rss/dol", genre: "business" },
  { name: "プレジデントオンライン", publisher: "プレジデントオンライン", siteUrl: "https://president.jp/", feedUrl: "https://president.jp/list/rss", genre: "business" },
  { name: "現代ビジネス", publisher: "現代ビジネス", siteUrl: "https://gendai.media/", feedUrl: "https://gendai.media/list/feed/rss", genre: "business" },

  // IT・科学
  { name: "WIRED.jp", publisher: "WIRED.jp", siteUrl: "https://wired.jp/", feedUrl: "https://wired.jp/feed/rss", genre: "tech" },
  { name: "ITmedia", publisher: "ITmedia", siteUrl: "https://www.itmedia.co.jp/", feedUrl: "https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml", genre: "tech" },
  { name: "GIGAZINE", publisher: "GIGAZINE", siteUrl: "https://gigazine.net/", feedUrl: "https://gigazine.net/news/rss_2.0/", genre: "tech" },
  { name: "Impress Watch", publisher: "Impress Watch", siteUrl: "https://www.watch.impress.co.jp/", feedUrl: "https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf", genre: "tech" },
  { name: "PC Watch", publisher: "Impress Watch", siteUrl: "https://pc.watch.impress.co.jp/", feedUrl: "https://pc.watch.impress.co.jp/data/rss/1.0/pcw/feed.rdf", genre: "tech" },
  { name: "AV Watch", publisher: "Impress Watch", siteUrl: "https://av.watch.impress.co.jp/", feedUrl: "https://av.watch.impress.co.jp/data/rss/1.0/avw/feed.rdf", genre: "tech" },
  { name: "Publickey", publisher: "Publickey", siteUrl: "https://www.publickey1.jp/", feedUrl: "https://www.publickey1.jp/atom.xml", genre: "tech" },
  { name: "ギズモード・ジャパン", publisher: "ギズモード・ジャパン", siteUrl: "https://www.gizmodo.jp/", feedUrl: "https://www.gizmodo.jp/index.xml", genre: "tech" },
  { name: "マイナビニュース", publisher: "マイナビニュース", siteUrl: "https://news.mynavi.jp/", feedUrl: "https://news.mynavi.jp/rss/index", genre: "tech" },
  { name: "はてなブックマーク IT", publisher: "はてなブックマーク", siteUrl: "https://b.hatena.ne.jp/hotentry/it", feedUrl: "https://b.hatena.ne.jp/hotentry/it.rss", genre: "tech", kind: "SOCIAL" },

  // エンタメ
  { name: "女性自身", publisher: "女性自身", siteUrl: "https://jisin.jp/", feedUrl: "https://jisin.jp/feed/", genre: "entertainment" },
  { name: "東スポWEB", publisher: "東スポWEB", siteUrl: "https://www.tokyo-sports.co.jp/", feedUrl: "https://www.tokyo-sports.co.jp/list/feed/rss", genre: "entertainment" },
  { name: "朝日新聞 文化・芸能", publisher: "朝日新聞", siteUrl: "https://www.asahi.com/culture/", feedUrl: "https://www.asahi.com/rss/asahi/culture.rdf", genre: "entertainment", ...BLOCKED },
  { name: "毎日新聞 エンタメ", publisher: "毎日新聞", siteUrl: "https://mainichi.jp/enta/", feedUrl: "https://mainichi.jp/rss/etc/mainichi-enta.rss", genre: "entertainment", ...BLOCKED },
  { name: "日刊スポーツ 芸能", publisher: "日刊スポーツ", siteUrl: "https://www.nikkansports.com/entertainment/", feedUrl: "https://www.nikkansports.com/entertainment/atom.xml", genre: "entertainment", ...BLOCKED },
  { name: "ライブドアニュース 芸能", publisher: "ライブドアニュース", siteUrl: "https://news.livedoor.com/", feedUrl: "https://news.livedoor.com/topics/rss/ent.xml", genre: "entertainment" },
  { name: "音楽ナタリー", publisher: "ナタリー", siteUrl: "https://natalie.mu/music", feedUrl: "https://natalie.mu/music/feed/news", genre: "entertainment", ...BLOCKED },
  { name: "映画ナタリー", publisher: "ナタリー", siteUrl: "https://natalie.mu/eiga", feedUrl: "https://natalie.mu/eiga/feed/news", genre: "entertainment", ...BLOCKED },
  { name: "お笑いナタリー", publisher: "ナタリー", siteUrl: "https://natalie.mu/owarai", feedUrl: "https://natalie.mu/owarai/feed/news", genre: "entertainment", ...BLOCKED },
  { name: "はてなブックマーク エンタメ", publisher: "はてなブックマーク", siteUrl: "https://b.hatena.ne.jp/hotentry/entertainment", feedUrl: "https://b.hatena.ne.jp/hotentry/entertainment.rss", genre: "entertainment", kind: "SOCIAL" },

  // スポーツ
  { name: "Full-Count", publisher: "Full-Count", siteUrl: "https://full-count.jp/", feedUrl: "https://full-count.jp/feed/", genre: "sports" },
  { name: "BASEBALL KING", publisher: "BASEBALL KING", siteUrl: "https://baseballking.jp/", feedUrl: "https://baseballking.jp/feed", genre: "sports" },
  { name: "サッカーキング", publisher: "サッカーキング", siteUrl: "https://www.soccer-king.jp/", feedUrl: "https://www.soccer-king.jp/feed", genre: "sports" },
  { name: "ゲキサカ", publisher: "ゲキサカ", siteUrl: "https://web.gekisaka.jp/", feedUrl: "https://web.gekisaka.jp/feed", genre: "sports" },
  { name: "FOOTBALL ZONE", publisher: "FOOTBALL ZONE", siteUrl: "https://www.football-zone.net/", feedUrl: "https://www.football-zone.net/feed", genre: "sports" },
  { name: "バスケットボールキング", publisher: "バスケットボールキング", siteUrl: "https://basketballking.jp/", feedUrl: "https://basketballking.jp/feed", genre: "sports" },
  { name: "THE ANSWER", publisher: "THE ANSWER", siteUrl: "https://the-ans.jp/", feedUrl: "https://the-ans.jp/feed/", genre: "sports" },
  { name: "朝日新聞 スポーツ", publisher: "朝日新聞", siteUrl: "https://www.asahi.com/sports/", feedUrl: "https://www.asahi.com/rss/asahi/sports.rdf", genre: "sports", ...BLOCKED },
  { name: "毎日新聞 スポーツ", publisher: "毎日新聞", siteUrl: "https://mainichi.jp/sports/", feedUrl: "https://mainichi.jp/rss/etc/mainichi-sports.rss", genre: "sports", ...BLOCKED },
  { name: "スポーツ報知", publisher: "スポーツ報知", siteUrl: "https://hochi.news/", feedUrl: "https://hochi.news/rss/index.xml", genre: "sports", ...BLOCKED },
  { name: "日刊スポーツ", publisher: "日刊スポーツ", siteUrl: "https://www.nikkansports.com/sports/", feedUrl: "https://www.nikkansports.com/sports/atom.xml", genre: "sports", ...BLOCKED },
  { name: "日刊スポーツ 野球", publisher: "日刊スポーツ", siteUrl: "https://www.nikkansports.com/baseball/", feedUrl: "https://www.nikkansports.com/baseball/atom.xml", genre: "sports", ...BLOCKED },
  { name: "日刊スポーツ サッカー", publisher: "日刊スポーツ", siteUrl: "https://www.nikkansports.com/soccer/", feedUrl: "https://www.nikkansports.com/soccer/atom.xml", genre: "sports", ...BLOCKED },
  { name: "ライブドアニュース スポーツ", publisher: "ライブドアニュース", siteUrl: "https://news.livedoor.com/", feedUrl: "https://news.livedoor.com/topics/rss/spo.xml", genre: "sports" },

  // ゲーム・アニメ
  { name: "アニメ！アニメ！", publisher: "アニメ！アニメ！", siteUrl: "https://animeanime.jp/", feedUrl: "https://animeanime.jp/rss/index.rdf", genre: "game" },
  { name: "インサイド", publisher: "インサイド", siteUrl: "https://www.inside-games.jp/", feedUrl: "https://www.inside-games.jp/rss/index.rdf", genre: "game" },
  { name: "Game*Spark", publisher: "Game*Spark", siteUrl: "https://www.gamespark.jp/", feedUrl: "https://www.gamespark.jp/rss/index.rdf", genre: "game" },
  { name: "4Gamer.net", publisher: "4Gamer.net", siteUrl: "https://www.4gamer.net/", feedUrl: "https://www.4gamer.net/rss/index.xml", genre: "game" },
  { name: "GAME Watch", publisher: "Impress Watch", siteUrl: "https://game.watch.impress.co.jp/", feedUrl: "https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf", genre: "game" },
  { name: "AUTOMATON", publisher: "AUTOMATON", siteUrl: "https://automaton-media.com/", feedUrl: "https://automaton-media.com/feed/", genre: "game" },
  { name: "IGN Japan", publisher: "IGN Japan", siteUrl: "https://jp.ign.com/", feedUrl: "https://jp.ign.com/feed.xml", genre: "game", ...BLOCKED },
  { name: "コミックナタリー", publisher: "ナタリー", siteUrl: "https://natalie.mu/comic", feedUrl: "https://natalie.mu/comic/feed/news", genre: "game", ...BLOCKED },
  { name: "はてなブックマーク アニメとゲーム", publisher: "はてなブックマーク", siteUrl: "https://b.hatena.ne.jp/hotentry/game", feedUrl: "https://b.hatena.ne.jp/hotentry/game.rss", genre: "game", kind: "SOCIAL" },

  // 新商品・グルメ
  { name: "PR TIMES", publisher: "PR TIMES", siteUrl: "https://prtimes.jp/", feedUrl: "https://prtimes.jp/index.rdf", genre: "products", kind: "PRESS" },
  { name: "ファッションプレス", publisher: "ファッションプレス", siteUrl: "https://www.fashion-press.net/", feedUrl: "https://www.fashion-press.net/news/line.rss", genre: "products" },

  // ライフ・トレンド
  { name: "Sirabee", publisher: "Sirabee", siteUrl: "https://sirabee.com/", feedUrl: "https://sirabee.com/feed/", genre: "life" },
  { name: "ねとらぼ", publisher: "ITmedia", siteUrl: "https://nlab.itmedia.co.jp/", feedUrl: "https://rss.itmedia.co.jp/rss/2.0/netlab.xml", genre: "life" },
  { name: "ライフハッカー・ジャパン", publisher: "ライフハッカー・ジャパン", siteUrl: "https://www.lifehacker.jp/", feedUrl: "https://www.lifehacker.jp/feed/index.xml", genre: "life" },
  { name: "Car Watch", publisher: "Impress Watch", siteUrl: "https://car.watch.impress.co.jp/", feedUrl: "https://car.watch.impress.co.jp/data/rss/1.0/car/feed.rdf", genre: "life" },
  { name: "はてなブックマーク 暮らし", publisher: "はてなブックマーク", siteUrl: "https://b.hatena.ne.jp/hotentry/life", feedUrl: "https://b.hatena.ne.jp/hotentry/life.rss", genre: "life", kind: "SOCIAL" },
  { name: "はてなブックマーク 世の中", publisher: "はてなブックマーク", siteUrl: "https://b.hatena.ne.jp/hotentry/social", feedUrl: "https://b.hatena.ne.jp/hotentry/social.rss", genre: "domestic", kind: "SOCIAL" },
  { name: "はてなブックマーク 政治と経済", publisher: "はてなブックマーク", siteUrl: "https://b.hatena.ne.jp/hotentry/economics", feedUrl: "https://b.hatena.ne.jp/hotentry/economics.rss", genre: "business", kind: "SOCIAL" },
];
