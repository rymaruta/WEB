/**
 * 作品ページ（ゲーム・アニメ）の共通の決まり（画面からも使うので DB に依存しない）。
 * 同じ作品の話題を1つのページにまとめるための呼び名と、ページのアドレス
 */

export type WorkKind = "game" | "anime" | "movie";

/** 作品をまとめる呼び名（大文字小文字・空白・記号の違いを吸収する） */
export function workKey(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/[\s・:：\-－〜~「」『』！!？?]+/g, "");
}

export const workPath = (kind: WorkKind, key: string) => `/${kind}/${encodeURIComponent(key)}`;

/** 日付の表示（2026年11月20日（金）、2026年11月、2027年） */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!m) return `${y}年`;
  if (!d) return `${y}年${m}月`;
  return `${y}年${m}月${d}日（${"日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

/** 発売・放送開始までの日数の表示（日まで決まっているときだけ）。過ぎていれば null */
export function daysUntil(date: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return d >= 0 ? d : null;
}

/** もう来た日付か（月・年までのものは、その期間が終わってから） */
export function isPast(date: string, today: string): boolean {
  return today.slice(0, date.length) > date;
}

/** URL の作品の呼び名を読む（エンコードされたまま届いた場合も戻す） */
export function readWorkParam(raw: string): string {
  let key = raw;
  try {
    if (/%[0-9a-f]{2}/i.test(raw)) key = decodeURIComponent(raw);
  } catch {}
  return workKey(key).slice(0, 80);
}
