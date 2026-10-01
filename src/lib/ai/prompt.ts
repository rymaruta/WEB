import { z } from "zod";
import { publisherLabel } from "@/lib/publisher";
import { formatDateTime } from "@/lib/format";
import { GameSchema, verifyGame } from "@/lib/game";
import { MARKET_EVENT_KEYS, verifyMarketEvent } from "@/lib/market-event";
import { BANNED_WORDS, extractFacts, factInSources } from "@/lib/stories/verify";

/** まとめ記事の出力形式・指示文・検証。DB や API に依存しない部分 */

/** サイトのジャンル（prisma/catalog.ts の slug と同じ） */
export const GENRE_SLUGS = ["domestic", "world", "business", "tech", "entertainment", "sports", "game", "anime", "products", "life"] as const;

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
  angles: z
    .array(
      z.object({
        text: z.string().describe("どの媒体が何に重点を置いて報じたかを1文で。例: 「A新聞は業績の数字を、B社は今後の需要の見通しを中心に報じた」"),
        sources: z.array(z.number().int()).describe("この文で取り上げた媒体の資料番号（1始まり）"),
      }),
    )
    // 以前の形式（angles なし）で送られた記事も受け付ける
    .optional()
    .describe(
      "各媒体の報じ方の違い。資料の見出し・要約に、注目点や伝え方の違いが実際にあるときだけ1〜3個。媒体名を必ず入れる。違いがなければ空配列。資料にない評価（偏っている・正確だ など）は書かない",
    ),
  companies: z
    .array(z.string())
    // 以前の形式（companies なし）で送られた記事も受け付ける
    .optional()
    .describe(
      "この出来事の当事者である企業の名前（0〜5社）。資料に書かれている表記のまま、「株式会社」「(株)」は付けない（例: トヨタ自動車、ソニーグループ、Micron）。官公庁・自治体・団体・スポーツチーム・媒体名は含めない。単に言及されただけの企業も含めない",
    ),
  marketEvent: z
    .enum(MARKET_EVENT_KEYS)
    .nullable()
    // 以前の形式（marketEvent なし）で送られた記事も受け付ける
    .optional()
    .describe(
      "企業の業績・資本に関わる出来事なら種類を選ぶ。earnings=決算発表、forecast=業績予想の修正、deal=買収・合併・資本提携・TOB、shareholder=配当・自社株買い・株式分割、listing=上場・上場廃止。新商品や不祥事などそれ以外は null",
    ),
  game: GameSchema.nullable()
    // 以前の形式（game なし）で送られた記事も受け付ける
    .optional()
    .describe("ゲームの話題（新作の発表・発売日・発売・アップデート・セールや無料配布）なら記入する。複数の作品が出る場合は中心の1作品。ゲーム以外の話題は null"),
  body: z
    .array(z.string())
    .describe(
      "本文の段落。リードと要点に書いたことは繰り返さず、資料にある背景・経緯・数字の内訳・今後の予定など、要点を補う内容だけを書く。補う内容が少なければ1段落・100文字程度でよい。最大3段落・500文字",
    ),
  sufficient: z.boolean().describe("資料だけで記事を書くのに十分な情報があれば true"),
  genre: z
    .enum(GENRE_SLUGS)
    .nullable()
    // 以前の形式（genre なし）で送られた記事も受け付ける
    .optional()
    .describe(
      "出来事の内容で決めるジャンル（どの媒体が報じたかではなく、何についての出来事か）。domestic=国内の政治・社会・事件、world=海外の出来事・国際関係、business=経済・企業・市場、tech=IT・科学、entertainment=芸能・映画・音楽・テレビ、sports=スポーツ、game=ゲーム（家庭用・PC・スマホのゲーム、ゲーム機、e スポーツ）、anime=アニメ・漫画（アニメ作品・漫画・声優の作品情報）、products=新商品・グルメ、life=暮らし・トレンド。迷う場合は null",
    ),
});

export type GeneratedArticle = z.infer<typeof ArticleSchema>;

export const SYSTEM = `あなたはニュースまとめサイトの編集者です。同じ出来事を報じた複数の媒体の「見出し」と「短い要約」を資料として受け取り、読者が短時間で全体像をつかめる日本語のまとめ記事を書きます。

厳守すること:
- 資料に書かれている事実だけを使う。資料にない数字・人名・経緯・背景知識を補わない。推測や意見を書かない。
- 媒体間で内容が食い違う場合は、どの媒体がどう報じているかを分けて書く。
- リード・要点・本文で同じ事実を繰り返さない。読者が同じ文を何度も読まずに済むよう、本文は要点を補う内容だけにする。
- 噂・リーク・関係者情報は、公式の発表と区別し「〜と報じられている」「〜というリークがある」のように書き、事実として断定しない。
- 媒体ごとの注目点の違い（数字を中心に報じた、影響を中心に報じた など）は angles に書く。違いがなければ無理に作らない。
- 各要点の sources には、その要点の根拠になった資料番号をすべて入れる。
- 資料の文章をそのまま長く引き写さず、自分の言葉で簡潔にまとめる。
- 事件・事故・訃報などは、センセーショナルな表現を避け、落ち着いた文体で書く。
- 資料が少なすぎる、または内容がばらばらで同じ出来事とは言えない場合は sufficient を false にする。`;

export function buildPrompt(sources: { publisher: string; publishedAt: Date; title: string; summary: string | null; kind: string }[]) {
  const lines = sources.map((s, i) => {
    const label = s.kind === "PRESS" ? "（企業発表）" : "";
    return `[${i + 1}] ${publisherLabel(s.publisher)}${label}／${formatDateTime(s.publishedAt)}\n見出し: ${s.title}\n要約: ${s.summary ?? "（なし）"}`;
  });
  return `次の資料をもとに、まとめ記事を書いてください。\n\n${lines.join("\n\n")}`;
}

/** 企業名の表記をそろえる（法人格や空白を除く） */
export function normalizeCompany(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)|㈱/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 生成結果の検証。出典番号が資料の範囲外なら取り除き、要点が残らなければ不採用 */
export function sanitizeArticle(a: GeneratedArticle, sourceCount: number): GeneratedArticle | null {
  if (!a.sufficient) return null;
  const points = a.points
    .map((p) => ({ text: p.text.trim(), sources: [...new Set(p.sources)].filter((n) => n >= 1 && n <= sourceCount).sort((x, y) => x - y) }))
    .filter((p) => p.text && p.sources.length > 0);
  const angles = (a.angles ?? [])
    .map((p) => ({ text: p.text.trim(), sources: [...new Set(p.sources)].filter((n) => n >= 1 && n <= sourceCount).sort((x, y) => x - y) }))
    .filter((p) => p.text && p.sources.length > 0)
    .slice(0, 3);
  const companies = [...new Set((a.companies ?? []).map(normalizeCompany).filter((c) => c.length >= 2 && c.length <= 30))].slice(0, 5);
  const body = a.body.map((b) => b.trim()).filter(Boolean);
  if (!a.title.trim() || points.length === 0 || body.length === 0) return null;
  return { ...a, title: a.title.trim().slice(0, 80), lead: a.lead.trim(), points: points.slice(0, 6), angles, companies, body };
}

export type FactSource = { publisher: string; publishedAt: Date; title: string; summary: string | null };

export type FactCheck = { article: GeneratedArticle | null; missing: string[]; banned: string[] };

/**
 * 資料との照合。AI の文章を信用せず、数字・カギかっこの語・英数字の語が資料にあるかを機械的に確かめる。
 * - 見出し・リード・要点：資料にない語が1つでもあれば記事を採用しない（要点は、その要点の出典に限って照合する）
 * - 本文：資料にない語を含む段落だけを落とす（すべて落ちたら採用しない）
 * - 報じ方の違い：取り上げた媒体の資料にない語、または煽り表現を含む項目だけを落とす
 * - 煽り表現が見出し・リード・要点にあれば採用しない
 * @param sources 出典番号 1, 2, ... に対応する資料
 */
export function checkArticleFacts(a: GeneratedArticle, sources: FactSource[]): FactCheck {
  const text = (s: FactSource) => `${s.publisher} ${publisherLabel(s.publisher)} ${formatDateTime(s.publishedAt)} ${s.title} ${s.summary ?? ""}`;
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
  const angles = (a.angles ?? []).filter((p) => {
    const cited = p.sources.map((n) => sources[n - 1]).filter(Boolean).map(text).join("\n");
    const m = missingIn(p.text, cited);
    bodyMissing.push(...m);
    return m.length === 0 && !BANNED_WORDS.some((w) => p.text.includes(w));
  });
  // 企業名は資料のどこかにそのまま書かれているものだけを残す（AI が補った社名を企業ページに載せない）
  const corpus = all.normalize("NFKC");
  const companies = (a.companies ?? []).filter((c) => corpus.includes(c));
  const marketEvent = verifyMarketEvent(a.marketEvent, all);
  const game = verifyGame(a.game, all);
  return { article: { ...a, body, angles, companies, marketEvent, game }, missing: bodyMissing, banned };
}
