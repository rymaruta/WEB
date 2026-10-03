/**
 * 見出しから、サムネイルに描く事実（試合のスコア・主役の数字）を読み取る（AI を使わない・DB に依存しない）。
 * 見出しに書かれている値だけを使い、読み取れないときは null（推測で補わない）。
 */

import { COUNTRIES } from "./tags";

/** 試合の結果。a が見出しの主語（先に書かれたチーム）で、スコアも見出しの順（主語の得点が先） */
export type ScoreFact = { kind: "score"; a: string; b: string; scoreA: number; scoreB: number };
/** 主役の数字。label は数字の前に書かれた語（何の数字か）、trend は数字の後の変化の語（増・減・悪化など） */
export type NumberFact = { kind: "number"; label: string; value: string; trend: string | null };
export type ThumbFact = ScoreFact | NumberFact;

/** チーム・国の名前（見出しに出る短い呼び名） */
const CLUBS = [
  "巨人", "阪神", "DeNA", "広島", "中日", "ヤクルト", "ソフトバンク", "日本ハム", "ロッテ", "楽天", "オリックス", "西武",
  "ドジャース", "パドレス", "カブス", "マリナーズ", "ヤンキース", "メッツ", "エンゼルス", "ブルージェイズ",
  "鹿島", "浦和", "川崎F", "横浜FM", "G大阪", "C大阪", "神戸", "名古屋", "柏", "FC東京", "町田", "湘南", "新潟", "福岡", "札幌",
  "侍ジャパン", "なでしこ", "日本代表", "日本",
  // 代表戦で見出しに出る国
  "ベルギー", "トルコ", "ポーランド", "ルーマニア", "フランス", "イタリア", "ドイツ", "スペイン", "イングランド", "オランダ", "ポルトガル",
  "ブラジル", "アルゼンチン", "ウルグアイ", "メキシコ", "オーストラリア", "サウジアラビア", "イラン", "イラク", "カタール", "ウズベキスタン", "中国", "韓国", "北朝鮮",
];
const NAMES = [...new Set([...CLUBS, ...COUNTRIES.map((c) => c.name)])].sort((x, y) => y.length - x.length);
const NAME_RE = new RegExp(NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
const SCORE_RE = /(\d{1,3})\s*[－\-−–対]\s*(\d{1,3})(?![\d月日年時分])/;

/** 試合のスコアを読む（スポーツの話題で、チーム・国の名前がちょうど2つと、スコアが1つ書かれているときだけ） */
export function readScore(title: string): ScoreFact | null {
  const t = title.normalize("NFKC");
  const m = t.match(SCORE_RE);
  if (!m || m.index === undefined) return null;
  // スコアより前に書かれた名前だけを使う（後ろの名前は別の試合・別の話のことがある）
  const before = t.slice(0, m.index);
  const names = [...new Set([...before.matchAll(NAME_RE)].map((x) => x[0]))];
  if (names.length !== 2) return null;
  const scoreA = Number(m[1]);
  const scoreB = Number(m[2]);
  if (scoreA > 30 || scoreB > 30) return null;
  return { kind: "score", a: names[0], b: names[1], scoreA, scoreB };
}

/** 主役になる数字（単位つき）。日付・回・順位・年齢は除く */
const NUMBER_RE = /(\d+(?:[.,]\d+)?(?:万|億|兆)?)(%|％|円|ドル|人|件|台|倍|バレル|万人|万円|億円|兆円|ポイント|店舗|社)/;
const TREND_RE = /^(?:台)?(?:の|に|へ|と|で)?(増加|増|減少|減|上昇|低下|悪化|改善|突破|値上げ|値下げ|超え|超|最高|最低|過去最高|過去最多|最多)/;

export function readNumber(title: string): NumberFact | null {
  const t = title.normalize("NFKC");
  const m = t.match(NUMBER_RE);
  if (!m || m.index === undefined) return null;
  // 何の数字か：数字の直前の語（区切りの記号・助詞の手前まで、最大12文字）
  const head = t
    .slice(0, m.index)
    .replace(/[はがのをに、,。:：・\s「」『』【】]+$/u, "")
    .split(/[、,。:：「」『』【】\s]/u)
    .filter(Boolean)
    .pop();
  if (!head) return null;
  const label = Array.from(head).slice(-12).join("");
  const tail = t.slice(m.index + m[0].length);
  const trend = tail.match(TREND_RE)?.[1] ?? null;
  return { kind: "number", label, value: `${m[1]}${m[2] === "％" ? "%" : m[2]}`, trend };
}

/** サムネイルに描く事実。スポーツはスコア、それ以外は主役の数字 */
export function readThumbFact(title: string, genreSlug: string): ThumbFact | null {
  if (genreSlug === "sports") return readScore(title);
  if (["domestic", "world", "business", "tech", "life", "products"].includes(genreSlug)) return readNumber(title);
  return null;
}
