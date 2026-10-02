/**
 * 話題をまとめてよいかの確認（DB に依存しない）。AI が「同じ出来事」と判定しても、
 * 見出しに共通の固有の語（人名・社名・作品名・地名など）がなく、時期も離れていれば、まとめない（別の出来事の誤統合を防ぐ）
 */

/** どの話題にも出やすく、同じ出来事の根拠にならない語 */
const STOP = new Set([
  "速報", "発表", "動画", "写真", "画像", "ニュース", "記事", "最新", "公開", "開始", "決定", "開催", "発売", "販売", "情報", "話題", "注目",
  "日本", "日本人", "東京", "大阪", "今年", "来年", "今日", "明日", "昨日", "今月", "来月", "今週", "年度", "について", "とは", "まとめ",
  "可能性", "理由", "方法", "結果", "影響", "対応", "問題", "会見", "コメント", "ファン", "ネット", "SNS", "公式", "新作", "限定", "記念",
]);

/** 見出しの中の、固有の語の候補（カタカナ2字以上・漢字2字以上・英数字2字以上） */
export function keyTerms(title: string): Set<string> {
  const t = title.normalize("NFKC");
  const terms = t.match(/[\p{Script=Katakana}ー]{2,}|[\p{Script=Han}々]{2,}|[A-Za-z][A-Za-z0-9&.+-]{1,}/gu) ?? [];
  return new Set(terms.map((w) => w.toLowerCase()).filter((w) => !STOP.has(w) && !/^\d+$/.test(w)));
}

/** 共通の語（短い語が長い語に含まれる場合も共通とみなす。例：「久保」と「久保建英」） */
export function sharedTerms(a: string, b: string): string[] {
  const ta = [...keyTerms(a)];
  const tb = [...keyTerms(b)];
  return ta.filter((x) => tb.some((y) => x === y || (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)))));
}

/** まとめてよい最大の時期のずれ（最初に報じられた時刻の差） */
export const MERGE_MAX_GAP_HOURS = 72;

export type MergeCheck = { ok: boolean; reason: string };

export function checkMerge(a: { title: string; firstSeenAt: Date }, b: { title: string; firstSeenAt: Date }): MergeCheck {
  const gap = Math.abs(a.firstSeenAt.getTime() - b.firstSeenAt.getTime()) / 3_600_000;
  if (gap > MERGE_MAX_GAP_HOURS) return { ok: false, reason: `時期が${Math.round(gap)}時間離れている` };
  const shared = sharedTerms(a.title, b.title);
  if (shared.length === 0) return { ok: false, reason: "見出しに共通の固有の語がない" };
  return { ok: true, reason: `共通の語: ${shared.slice(0, 5).join("・")}` };
}
