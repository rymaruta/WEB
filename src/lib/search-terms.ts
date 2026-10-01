/** 検索語の上限（長い語の羅列で重い問い合わせにならないように） */
const MAX_TERMS = 5;

/** 検索文字列を語に分ける。半角・全角の空白で区切り、重複と空の語を除く */
export function parseSearchTerms(q: string): string[] {
  return [...new Set(q.split(/[\s　]+/).map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TERMS);
}
