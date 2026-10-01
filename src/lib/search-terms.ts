/** 検索語の上限（長い語の羅列で重い問い合わせにならないように） */
const MAX_TERMS = 5;

/** 検索文字列を語に分ける。半角・全角の空白で区切り、重複と空の語を除く */
export function parseSearchTerms(q: string): string[] {
  return [...new Set(q.split(/[\s　]+/).map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TERMS);
}

/** 見出しにすべての語が入っているものを先にする（元の順番＝新しい順は、それぞれの中で保つ） */
export function rankSearchResults(items: { id: number; title: string; aiTitle: string | null }[], terms: string[]): number[] {
  const fold = (s: string) => s.normalize("NFKC").toLowerCase();
  const keys = terms.map(fold);
  const strong = (t: { title: string; aiTitle: string | null }) => {
    const text = fold(`${t.title} ${t.aiTitle ?? ""}`);
    return keys.every((k) => text.includes(k));
  };
  return [...items.filter(strong), ...items.filter((t) => !strong(t))].map((t) => t.id);
}
