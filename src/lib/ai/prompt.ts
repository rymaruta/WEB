import { z } from "zod";
import { formatDateTime } from "@/lib/format";
import { BANNED_WORDS, extractFacts, factInSources } from "@/lib/stories/verify";

/** まとめ記事の出力形式・指示文・検証。DB や API に依存しない部分 */

export const ArticleSchema = z.object({
  title: z.string().describe("記事の見出し。40文字以内。事実を端的に"),
  lead: z.string().describe("リード文。何が起きたかを1〜2文、100文字程度で"),
  points: z
    .array(
      z.object({
        text: z.string().describe("要点。1文で"),
        sources: z.array(z.number().int()).describe("この要点の根拠となる資料番号（1始まり）"),
      }),
    )
    .describe("要点を3〜5個"),
  body: z
    .array(z.string())
    .describe("本文の段落。2〜4段落、全体で300〜600文字。背景や各媒体の報じ方の違いも資料の範囲で"),
  sufficient: z.boolean().describe("資料だけで記事を書くのに十分な情報があれば true"),
});

export type GeneratedArticle = z.infer<typeof ArticleSchema>;

export const SYSTEM = `あなたはニュースまとめサイトの編集者です。同じ出来事を報じた複数の媒体の「見出し」と「短い要約」を資料として受け取り、読者が短時間で全体像をつかめる日本語のまとめ記事を書きます。

厳守すること:
- 資料に書かれている事実だけを使う。資料にない数字・人名・経緯・背景知識を補わない。推測や意見を書かない。
- 媒体間で内容が食い違う場合は、どの媒体がどう報じているかを分けて書く。
- 各要点の sources には、その要点の根拠になった資料番号をすべて入れる。
- 資料の文章をそのまま長く引き写さず、自分の言葉で簡潔にまとめる。
- 事件・事故・訃報などは、センセーショナルな表現を避け、落ち着いた文体で書く。
- 資料が少なすぎる、または内容がばらばらで同じ出来事とは言えない場合は sufficient を false にする。`;

export function buildPrompt(sources: { publisher: string; publishedAt: Date; title: string; summary: string | null; kind: string }[]) {
  const lines = sources.map((s, i) => {
    const label = s.kind === "PRESS" ? "（企業発表）" : "";
    return `[${i + 1}] ${s.publisher}${label}／${formatDateTime(s.publishedAt)}\n見出し: ${s.title}\n要約: ${s.summary ?? "（なし）"}`;
  });
  return `次の資料をもとに、まとめ記事を書いてください。\n\n${lines.join("\n\n")}`;
}

/** 生成結果の検証。出典番号が資料の範囲外なら取り除き、要点が残らなければ不採用 */
export function sanitizeArticle(a: GeneratedArticle, sourceCount: number): GeneratedArticle | null {
  if (!a.sufficient) return null;
  const points = a.points
    .map((p) => ({ text: p.text.trim(), sources: [...new Set(p.sources)].filter((n) => n >= 1 && n <= sourceCount).sort((x, y) => x - y) }))
    .filter((p) => p.text && p.sources.length > 0);
  const body = a.body.map((b) => b.trim()).filter(Boolean);
  if (!a.title.trim() || points.length === 0 || body.length === 0) return null;
  return { ...a, title: a.title.trim().slice(0, 80), lead: a.lead.trim(), points: points.slice(0, 6), body };
}

export type FactSource = { publisher: string; publishedAt: Date; title: string; summary: string | null };

export type FactCheck = { article: GeneratedArticle | null; missing: string[]; banned: string[] };

/**
 * 資料との照合。AI の文章を信用せず、数字・カギかっこの語・英数字の語が資料にあるかを機械的に確かめる。
 * - 見出し・リード・要点：資料にない語が1つでもあれば記事を採用しない（要点は、その要点の出典に限って照合する）
 * - 本文：資料にない語を含む段落だけを落とす（すべて落ちたら採用しない）
 * - 煽り表現が見出し・リード・要点にあれば採用しない
 * @param sources 出典番号 1, 2, ... に対応する資料
 */
export function checkArticleFacts(a: GeneratedArticle, sources: FactSource[]): FactCheck {
  const text = (s: FactSource) => `${s.publisher} ${formatDateTime(s.publishedAt)} ${s.title} ${s.summary ?? ""}`;
  const all = sources.map(text).join("\n");
  const missingIn = (t: string, corpus: string) => extractFacts(t).filter((f) => !factInSources(f, corpus));

  const missing = new Set<string>();
  for (const m of [...missingIn(a.title, all), ...missingIn(a.lead, all)]) missing.add(m);
  for (const p of a.points) {
    const cited = p.sources.map((n) => sources[n - 1]).filter(Boolean).map(text).join("\n");
    for (const m of missingIn(p.text, cited)) missing.add(m);
  }
  const visible = [a.title, a.lead, ...a.points.map((p) => p.text)].join("\n");
  const banned = BANNED_WORDS.filter((w) => visible.includes(w));
  if (missing.size > 0 || banned.length > 0) return { article: null, missing: [...missing], banned };

  const bodyMissing: string[] = [];
  const body = a.body.filter((para) => {
    const m = missingIn(para, all);
    bodyMissing.push(...m);
    return m.length === 0;
  });
  if (body.length === 0) return { article: null, missing: bodyMissing, banned };
  return { article: { ...a, body }, missing: bodyMissing, banned };
}
