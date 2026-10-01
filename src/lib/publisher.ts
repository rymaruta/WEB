/** ドメイン名で記録された媒体（ソーシャル経由の記事）を、読者に分かる名前にする */
const PUBLISHER_NAMES: Record<string, string> = {
  "yomiuri.co.jp": "読売新聞",
  "asahi.com": "朝日新聞",
  "mainichi.jp": "毎日新聞",
  "nikkei.com": "日本経済新聞",
  "sankei.com": "産経新聞",
  "tokyo-np.co.jp": "東京新聞",
  "jiji.com": "時事通信",
  "kyodonews.jp": "共同通信",
  "nhk.or.jp": "NHK",
  "news.yahoo.co.jp": "Yahoo!ニュース",
  "cnn.co.jp": "CNN",
  "bbc.com": "BBC",
  "reuters.com": "ロイター",
  "bloomberg.co.jp": "ブルームバーグ",
  "tv-asahi.co.jp": "テレビ朝日",
  "fnn.jp": "FNN",
  "news.tbs.co.jp": "TBS",
  "news.ntv.co.jp": "日本テレビ",
  "tdb.co.jp": "帝国データバンク",
  "tsr-net.co.jp": "東京商工リサーチ",
  "news.livedoor.com": "ライブドアニュース",
  "itmedia.co.jp": "ITmedia",
  "gigazine.net": "GIGAZINE",
  "toyokeizai.net": "東洋経済オンライン",
  "diamond.jp": "ダイヤモンド・オンライン",
  "president.jp": "プレジデントオンライン",
  "gendai.media": "現代ビジネス",
  "bunshun.jp": "文春オンライン",
  "j-cast.com": "J-CASTニュース",
  "watch.impress.co.jp": "Impress Watch",
  "internet.watch.impress.co.jp": "INTERNET Watch",
  "pc.watch.impress.co.jp": "PC Watch",
  "nordot.app": "共同通信（nordot）",
  "huffingtonpost.jp": "ハフポスト",
  "afpbb.com": "AFPBB News",
  "jp.reuters.com": "ロイター",
  "businessinsider.jp": "Business Insider Japan",
  "newsweekjapan.jp": "ニューズウィーク日本版",
  "nlab.itmedia.co.jp": "ねとらぼ",
  "news.mynavi.jp": "マイナビニュース",
  "prtimes.jp": "PR TIMES",
};

/** 媒体の表示名。ドメイン名なら読者に分かる名前にする（www3.nhk.or.jp → NHK のように、上位のドメインでも探す） */
export function publisherLabel(publisher: string): string {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(publisher)) return publisher;
  const parts = publisher.toLowerCase().replace(/^www\d*\./, "").split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const name = PUBLISHER_NAMES[parts.slice(i).join(".")];
    if (name) return name;
  }
  return publisher;
}
