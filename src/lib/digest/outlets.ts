import { AGGREGATORS, syndicationKey } from "@/lib/coverage";

/**
 * 報じた媒体の「独立した数」。配信の点数（信頼性・話題性）に使う。
 * - ほかの媒体の記事を転載して配信するだけの媒体（ポータル・まとめ）は数えない
 * - 同じ媒体の別の名前（「◯◯新聞」と「◯◯新聞デジタル」など）は1つとして数える
 * 立場（政治的な傾向）では区別しない。DB に依存しない
 */

/** 転載・まとめのポータル（自前の取材をしない配信先） */
const PORTALS = /^(yahoo|ヤフー|livedoor|ライブドア|goo|エキサイト|excite|infoseek|インフォシーク|au ?web|smartnews|スマートニュース|antenna|アンテナ|msn|line ?news|グノシー|gunosy|newspicks|ニコニコニュース|dメニュー)/;

/** 同じ媒体の別の名前を1つにそろえる（末尾の「デジタル」「オンライン」「ニュース」「.com」などを外す） */
export function outletKey(publisher: string): string {
  let k = publisher.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  k = k.replace(/^(www\.)/, "").replace(/\.(com|jp|co\.jp|net|ne\.jp|or\.jp)$/, "");
  for (let i = 0; i < 2; i++) k = k.replace(/(デジタル|オンライン|ドットコム|ニュース|アネックス|web|online|digital|news|plus|プラス)$/, "");
  const ALIASES: Record<string, string> = { nikkansports: "日刊スポーツ", 日経: "日本経済新聞", nikkei: "日本経済新聞", 時事: "時事通信", jiji: "時事通信", 47: "共同通信", 共同: "共同通信", sponichi: "スポニチ", nhk: "nhk" };
  return ALIASES[k] ?? k;
}

export const isPortal = (publisher: string) => AGGREGATORS.has(publisher) || PORTALS.test(publisher.normalize("NFKC").toLowerCase());

/** 独立した媒体の数（最低 1。媒体がすべて転載なら、転載元が分からないため 1 とみなす） */
export function independentOutlets(publishers: string[]): number {
  const keys = new Set(publishers.filter((p) => p && !isPortal(p)).map(outletKey));
  return Math.max(1, keys.size);
}

/**
 * 独立した媒体の数を、記事の見出しも見て数える。
 * 同じ見出しの記事は、提携先の記事をそのまま載せた転載として1つに数える（サッカーキングの記事をマイナビニュースが載せるなど）。
 * 転載元が分かるように、ポータルでない媒体の記事を先に見る
 */
export function independentOutletsOf(rows: { publisher: string; title: string }[]): number {
  const seen = new Set<string>();
  const publishers: string[] = [];
  for (const r of [...rows].sort((a, b) => Number(isPortal(a.publisher)) - Number(isPortal(b.publisher)))) {
    const key = syndicationKey(r.title, r.publisher);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    publishers.push(r.publisher);
  }
  return independentOutlets(publishers);
}
