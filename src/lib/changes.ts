import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { publisherLabel } from "@/lib/publisher";
import { bigrams } from "@/lib/topics/similarity";
import { verifyDate } from "./game";

/**
 * 「◯月から変わること」。値上げ・値下げ、制度や法律の施行、サービスの開始・終了など、暮らしに関わる変更を、
 * 始まる日ごとに一覧にする（国内・ライフのページ）。ゲームの発売スケジュールと同じく、
 * 1. 見出し・要約で候補を絞る → 2. 記事作成の定期処理（Claude Code）が読み取る → 3. 資料と照合して保存する
 */

export { CHANGE_KIND_LABELS, CHANGE_KINDS, type ChangeKind } from "./change-kinds";
import { CHANGE_KINDS, type ChangeKind } from "./change-kinds";

/** 候補を探すジャンル */
const CHANGE_GENRES = ["domestic", "business", "life", "products"];
/** 候補を探す範囲（最初の報道からの日数） */
const CANDIDATE_DAYS = 21;
/** 変更を表す語 */
const CHANGE_RE = /値上げ|値下げ|価格改定|料金改定|改定|施行|義務化|廃止|終了|開始|改正|引き上げ|引き下げ|から変わる|が変わる|スタート/;
/** 始まる時期 */
const WHEN_RE = /\d{1,2}月(\d{1,2}日)?(から|より|以降)|来月から|今月から|\d{1,2}月\d{1,2}日/;

export function isChangeCandidate(text: string): boolean {
  const t = text.normalize("NFKC");
  return CHANGE_RE.test(t) && WHEN_RE.test(t);
}

export const ChangeSchema = z.object({
  isChange: z
    .boolean()
    .describe("多くの人の暮らしに関わる変更（値上げ・値下げ、制度・法律の施行、公共・大手サービスの開始・終了など）が、決まった日から始まると報じている資料なら true。企業の人事、1店舗だけの話、イベントの開催、新商品の発売は false"),
  title: z.string().describe("何が変わるかを短く（20字以内）。資料の言葉を使う（例: 郵便料金の値上げ、マイナ保険証への移行）。数字は資料に書かれているものだけ"),
  startDate: z.string().describe("変更が始まる日。日まで書かれていれば YYYY-MM-DD、月までなら YYYY-MM。年が書かれていなければ記事の日付から見て次に来るその月の年"),
  kind: z.enum(CHANGE_KINDS).describe("price_up=値上げ、price_down=値下げ、rule=制度・法律、start=サービスなどの開始、end=サービスなどの終了、other=それ以外"),
});
export type ChangeInfo = z.infer<typeof ChangeSchema>;

export const ChangeExtractSchema = z.object({
  isChange: ChangeSchema.shape.isChange,
  change: ChangeSchema.omit({ isChange: true }).nullable().describe("isChange が true のときの情報。false なら null"),
});
export type ChangeExtract = z.infer<typeof ChangeExtractSchema>;

export const CHANGE_EXTRACT_SYSTEM = `あなたはニュースの編集者です。資料（記事の見出しと短い要約）だけを根拠に、「◯月から変わること」の一覧に載せる情報を読み取ります。
- 多くの人の暮らしに関わる変更だけを対象にする（値上げ・値下げ、制度・法律の施行、公共・大手サービスの開始・終了など）。企業の人事、1店舗だけの話、イベント、新商品の発売は対象外（isChange を false）。
- 資料に書かれていることだけを使う。何が・いつから・どう変わるかを推測しない。
- title は20字以内で、資料の言葉を使う。資料にない数字を入れない。
- startDate は資料に書かれている精度で書く（日まで→YYYY-MM-DD、月まで→YYYY-MM）。始まる日が書かれていなければ isChange を false にする。`;

export function buildChangePrompt(articles: { publisher: string; publishedAt: Date; title: string; summary: string | null }[]) {
  const lines = articles.map((a, i) => `[${i + 1}] ${publisherLabel(a.publisher)}／${formatDateTime(a.publishedAt)}\n見出し: ${a.title}\n要約: ${a.summary ?? "（なし）"}`);
  return `次の資料から、暮らしに関わる変更の情報を読み取ってください。\n\n${lines.join("\n\n")}`;
}

/**
 * 資料と照らし合わせる。始まる日が資料に書かれていて、見出しが資料の言葉でできている（文字の2字組の半分以上が資料にある）、
 * 見出しの数字がすべて資料にあるものだけを残す
 */
export function verifyChange(c: Omit<ChangeInfo, "isChange"> | null | undefined, sourceText: string): Omit<ChangeInfo, "isChange"> | null {
  if (!c) return null;
  const title = c.title.trim();
  if (!title || [...title].length > 24) return null;
  const date = verifyDate(c.startDate, sourceText);
  if (!date || !/^\d{4}-\d{2}(-\d{2})?$/.test(date)) return null;
  const corpus = sourceText.normalize("NFKC");
  const grams = bigrams(title);
  const found = grams.filter((g) => corpus.includes(g)).length;
  if (grams.length === 0 || found / grams.length < 0.5) return null;
  const numbers = title.normalize("NFKC").match(/\d+(\.\d+)?/g) ?? [];
  if (numbers.some((n) => !corpus.includes(n))) return null;
  return { title, startDate: date, kind: c.kind };
}

/** まだ確かめていない、暮らしに関わる変更の候補の話題（新しい順） */
export async function findChangeCandidates(limit: number, now = new Date()) {
  const topics = await prisma.topic.findMany({
    where: {
      genre: { slug: { in: CHANGE_GENRES } },
      aiChangeChecked: false,
      firstSeenAt: { gte: new Date(now.getTime() - CANDIDATE_DAYS * 86_400_000) },
    },
    orderBy: { firstSeenAt: "desc" },
    take: 600,
    select: { id: true, title: true, articles: { take: 3, orderBy: { publishedAt: "asc" }, select: { title: true, summary: true, publisher: true, publishedAt: true } } },
  });
  return topics
    .filter((t) => isChangeCandidate([t.title, ...t.articles.map((a) => `${a.title} ${a.summary ?? ""}`)].join(" ")))
    .slice(0, limit);
}

/** 読み取りの結果を、資料と照合して保存する */
export async function saveChangeExtract(topicId: number, result: ChangeExtract) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { articles: { select: { title: true, summary: true } } } });
  if (!topic) throw new Error("topic not found");
  const corpus = topic.articles.map((a) => `${a.title}\n${a.summary ?? ""}`).join("\n");
  const change = result.isChange ? verifyChange(result.change, corpus) : null;
  await prisma.topic.update({
    where: { id: topicId },
    data: { aiChangeChecked: true, aiChangeTitle: change?.title ?? null, aiChangeDate: change?.startDate ?? null, aiChangeKind: change?.kind ?? null },
  });
  return { saved: change };
}

export type { ChangeItem } from "./change-kinds";
import type { ChangeItem } from "./change-kinds";

/** 指定した月（YYYY-MM の配列）に始まる変更。同じ見出しは1件にまとめ、日付順 */
export async function getChanges(months: string[]): Promise<ChangeItem[]> {
  const topics = await prisma.topic.findMany({
    where: { aiChangeTitle: { not: null }, OR: months.map((m) => ({ aiChangeDate: { startsWith: m } })) },
    orderBy: { lastSeenAt: "desc" },
    take: 500,
    select: { id: true, aiChangeTitle: true, aiChangeDate: true, aiChangeKind: true },
  });
  const seen = new Set<string>();
  const out: ChangeItem[] = [];
  for (const t of topics) {
    const key = t.aiChangeTitle!.normalize("NFKC").replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ topicId: t.id, title: t.aiChangeTitle!, date: t.aiChangeDate!, kind: (t.aiChangeKind ?? "other") as ChangeKind });
  }
  // 日が決まっているものを先に、月だけのものはその月の最後に
  const sortKey = (d: string) => (d.length === 7 ? `${d}-32` : d);
  return out.sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)));
}
