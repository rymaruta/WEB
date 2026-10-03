/** 検索語の上限（長い語の羅列で重い問い合わせにならないように） */
const MAX_TERMS = 5;
/** 1語あたりの表記の上限（問い合わせが重くならないように） */
const MAX_VARIANTS = 6;

/** 検索文字列を語に分ける。半角・全角の空白で区切り、重複と空の語を除く */
export function parseSearchTerms(q: string): string[] {
  return [...new Set(q.split(/[\s　]+/).map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TERMS);
}

/** ひらがなをカタカナに（「すまほ」→「スマホ」） */
const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
/** カタカナをひらがなに（「ネコ」→「ねこ」） */
const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
/** 半角の英数字を全角に（見出しに「ＡＩ」「ｉＰｈｏｎｅ」と全角で書く媒体があるため） */
const toFullWidth = (s: string) => s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));

/** よく使われる略称と正式な名前（どちらで探しても見つかるように）。左右どちらからでも引く */
const SYNONYMS: [string, string][] = [
  ["スタバ", "スターバックス"],
  ["マック", "マクドナルド"],
  ["マクド", "マクドナルド"],
  ["ユニクロ", "UNIQLO"],
  ["ドコモ", "NTTドコモ"],
  ["日銀", "日本銀行"],
  ["大リーグ", "MLB"],
  ["ワールドカップ", "W杯"],
  ["チャットGPT", "ChatGPT"],
  ["アイフォン", "iPhone"],
  ["スイッチ2", "Switch 2"],
  ["ポケモン", "ポケットモンスター"],
];

/**
 * 1語の表記ゆれ（全角・半角、大文字・小文字、ひらがな・カタカナ、略称）。
 * 見出しはどちらの表記でも書かれるため、どれか1つが含まれれば当たりにする
 */
export function termVariants(term: string): string[] {
  const base = term.normalize("NFKC");
  const out = new Set([term, base]);
  if (/[!-~]/.test(base)) out.add(toFullWidth(base));
  if (/[ぁ-ゖ]/.test(base)) out.add(toKatakana(base));
  if (/[ァ-ヶ]/.test(base)) out.add(toHiragana(base));
  const lower = base.toLowerCase();
  for (const [a, b] of SYNONYMS) {
    if (a.toLowerCase() === lower) out.add(b);
    if (b.toLowerCase() === lower) out.add(a);
  }
  return [...out].slice(0, MAX_VARIANTS);
}

/** 比べるための形（全角・半角と大文字・小文字、ひらがな・カタカナの違いをなくす） */
export const foldText = (s: string) => toKatakana(s.normalize("NFKC").toLowerCase());

type Rankable = { id: number; title: string; aiTitle: string | null; lastSeenAt?: Date; publisherCount?: number };

/**
 * 検索結果の並び。
 * 1. 見出し（AI の見出しを含む）にすべての語が入っているもの（語が記事の見出しにしかないものは後）
 * 2. 同じ段の中は、新しい日のものから。同じ日の中は、報じた媒体が多いものから
 */
export function rankSearchResults(items: Rankable[], terms: string[]): number[] {
  const keys = terms.map((t) => termVariants(t).map(foldText));
  const strong = (t: Rankable) => {
    const text = foldText(`${t.title} ${t.aiTitle ?? ""}`);
    return keys.every((variants) => variants.some((k) => text.includes(k)));
  };
  const day = (t: Rankable) => (t.lastSeenAt ? Math.floor((t.lastSeenAt.getTime() + 9 * 3_600_000) / 86_400_000) : 0);
  const order = (a: Rankable, b: Rankable) => day(b) - day(a) || (b.publisherCount ?? 0) - (a.publisherCount ?? 0);
  // 日付がない（並べ替えの材料がない）場合は、渡された順（新しい順）を保つ
  const sorted = (list: Rankable[]) => (list.every((t) => t.lastSeenAt) ? [...list].sort(order) : list);
  return [...sorted(items.filter(strong)), ...sorted(items.filter((t) => !strong(t)))].map((t) => t.id);
}
