/**
 * 検索エンジンに登録するまとめ記事の基準。
 * 他社の記事を AI でまとめただけのページを大量に登録すると、サイト全体の評価が下がることがある。
 * 独自の価値がある記事だけを登録する：
 * - 3媒体以上の報道を突き合わせた記事（1〜2媒体の言い換えにならない）
 * - 各社の報じ方の違いを書いた記事
 * - これまでの経緯（このサイトの過去の記事）を添えた記事
 */
export const INDEX_MIN_PUBLISHERS = 3;

export function isIndexableArticle(t: { publisherCount: number; hasAi: boolean; angles: number; background: number }): boolean {
  if (!t.hasAi) return false;
  return t.publisherCount >= INDEX_MIN_PUBLISHERS || t.angles > 0 || t.background > 0;
}

/** JSON の配列の長さ（保存された値が配列でなければ 0） */
export const jsonLength = (v: unknown) => (Array.isArray(v) ? v.length : 0);
