/**
 * 検索エンジンに登録するまとめ記事の基準。
 * 他社の記事を AI でまとめただけのページを大量に登録すると、サイト全体の評価が下がることがある。
 * 独自の価値がある記事だけを登録する：
 * - 3媒体以上の報道を突き合わせた記事（1〜2媒体の言い換えにならない）
 * - 各社の報じ方の違いを書いた記事
 * - これまでの経緯（このサイトの過去の記事）を添えた記事
 */
export const INDEX_MIN_PUBLISHERS = 3;
/** 要点がこれより少ない記事は、見出しの言い換えにとどまりやすいため登録しない（2026-10-04 の記事監査で要点2つ以下の4本が薄い内容だった） */
export const INDEX_MIN_POINTS = 3;

export type IndexInput = {
  publisherCount: number;
  hasAi: boolean;
  angles: number;
  background: number;
  /** 要点の数（分からなければ数えない） */
  points?: number;
  /** 編集部の点検で「検索から外す」とした記事（src/lib/review.ts） */
  held?: boolean;
};

export function isIndexableArticle(t: IndexInput): boolean {
  if (!t.hasAi || t.held) return false;
  if (t.points !== undefined && t.points < INDEX_MIN_POINTS) return false;
  return t.publisherCount >= INDEX_MIN_PUBLISHERS || t.angles > 0 || t.background > 0;
}

/** JSON の配列の長さ（保存された値が配列でなければ 0） */
export const jsonLength = (v: unknown) => (Array.isArray(v) ? v.length : 0);
