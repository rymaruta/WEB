/**
 * 話題をまとめてよいかの確認（DB に依存しない）。AI が「同じ出来事」と判定しても、
 * 見出しに共通の固有の語（人名・社名・作品名・地名など）がなく、時期も離れていれば、まとめない（別の出来事の誤統合を防ぐ）
 */

import { extractNames } from "@/lib/stories/verify";

/** どの話題にも出やすく、同じ出来事の根拠にならない語 */
const STOP = new Set([
  "速報", "発表", "動画", "写真", "画像", "ニュース", "記事", "最新", "公開", "開始", "決定", "開催", "発売", "販売", "情報", "話題", "注目",
  "日本", "日本人", "東京", "大阪", "今年", "来年", "今日", "明日", "昨日", "今月", "来月", "今週", "年度", "について", "とは", "まとめ",
  "可能性", "理由", "方法", "結果", "影響", "対応", "問題", "会見", "コメント", "ファン", "ネット", "SNS", "公式", "新作", "限定", "記念",
  // 多くの出来事に共通する一般の語（「佐川急便の不正アクセス」と「ヤマト運輸の不正アクセス」を同じ出来事にしない）
  "サービス", "不正", "アクセス", "不正アクセス", "利用者", "利用", "情報", "個人情報", "流出", "漏えい", "事故", "事件", "逮捕", "容疑",
  "試合", "大会", "決勝", "優勝", "選手", "監督", "代表", "アジア", "日本代表", "政府", "首相", "大臣", "会社", "企業", "社長", "発売", "開催",
]);

/** 人名・役職の後ろに付く語。「立花氏」と「立花孝志被告」を同じ人として比べるために外す */
const NAME_TAIL = /(氏|さん|被告|容疑者|選手|監督|社長|首相|大臣|農相|農水相|知事|議員)$/u;

/** 役職・敬称つきの人名（「簗農水相」「簗和生農相」「泉健太氏」）の、名前の部分 */
const PERSON = /([\p{Script=Han}々]{1,4})(?:氏|さん|被告|容疑者|選手|監督|社長|首相|農水大臣|大臣|農水相|農相|知事|議員)/gu;
export function personNames(title: string): string[] {
  return [...title.normalize("NFKC").matchAll(PERSON)].map((m) => m[1]);
}

/** 見出しの中の、固有の語の候補（カタカナ2字以上・漢字2字以上・英数字2字以上） */
export function keyTerms(title: string): Set<string> {
  const t = title.normalize("NFKC");
  // カタカナと漢字が続く語（「アジア大会」「中国外務省」）も1語として拾う（大会名・組織名の一致を見落とさないように）
  const terms = t.match(/[\p{Script=Katakana}ー]+[\p{Script=Han}々]+|[\p{Script=Katakana}ー]{2,}|[\p{Script=Han}々]{2,}|[A-Za-z][A-Za-z0-9&.+-]{1,}/gu) ?? [];
  return new Set(
    terms
      // 役職を外して1字しか残らない名前（「簗農水相」の「簗」）は、外さずに比べる
      .map((w) => {
        const x = w.toLowerCase();
        const y = x.replace(NAME_TAIL, "");
        return y.length >= 2 ? y : x;
      })
      .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w)),
  );
}

/** 2つの語に共通する、2字以上の連続した文字（なければ空） */
function commonRun(x: string, y: string): string {
  for (let len = Math.min(x.length, y.length); len >= 2; len--) {
    for (let i = 0; i + len <= x.length; i++) if (y.includes(x.slice(i, i + len))) return x.slice(i, i + len);
  }
  return "";
}

/**
 * 共通の語（短い語が長い語に含まれる場合も共通とみなす。例：「久保」と「久保建英」）。
 * 人名（「◯◯氏」「◯◯被告」の◯◯）は、前後に別の語がつながっていても名字の一致で同じ人とみなす（例：「Ｎ党立花氏」と「立花孝志被告」）
 */
export function sharedTerms(a: string, b: string): string[] {
  const ta = [...keyTerms(a)];
  const tb = [...keyTerms(b)];
  const terms = ta.filter((x) => tb.some((y) => x === y || (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x)))));
  const na = extractNames(a);
  const nb = extractNames(b);
  for (const x of na) for (const y of nb) {
    const run = commonRun(x, y);
    if (run && !terms.includes(run)) terms.push(run);
  }
  // 1字の名字（「簗農水相」の「簗」）は、もう一方の見出しで同じ字が役職・敬称つきの名前の先頭にあれば同じ人とみなす（例：「簗和生農相」）。
  // 役職・敬称つきの名前どうしに限る（「林農相」と「林業」は同じにしない）
  const pa = personNames(a);
  const pb = personNames(b);
  for (const [xs, ys] of [[pa, pb], [pb, pa]])
    for (const x of xs.filter((n) => n.length === 1))
      if (ys.some((y) => y.indexOf(x) >= 0 && y.indexOf(x) <= 1) && !terms.includes(x)) terms.push(x);
  return terms;
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
