import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { publisherLabel } from "@/lib/publisher";
import { verifyDate } from "./game";
import { PRODUCT_KINDS, type ProductItem, type ProductKind } from "./product-kinds";

export { PRODUCT_KIND_LABELS, PRODUCT_KINDS, type ProductItem, type ProductKind } from "./product-kinds";

/**
 * 「今週の新発売」。新商品・グルメのページで、今週・来週に発売される商品を週ごとに一覧にする。
 * 「◯月から変わること」と同じく、1. 見出し・要約で候補を絞る → 2. 記事作成の定期処理が読み取る → 3. 資料と照合して保存する
 */

const PRODUCT_GENRES = ["products", "tech"];
const CANDIDATE_DAYS = 14;
const RELEASE_RE = /発売|販売開始|販売を開始|新登場|登場|予約開始/;
const DAY_RE = /\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}/;
/** 商品の発売ではないもの */
const EXCLUDE_RE = /レポート|調査|セミナー|求人|採用|決算|資金調達|イベント開催|キャンペーン実施/;

export function isProductCandidate(text: string): boolean {
  const t = text.normalize("NFKC");
  return RELEASE_RE.test(t) && DAY_RE.test(t) && !EXCLUDE_RE.test(t);
}

export const ProductExtractSchema = z.object({
  isRelease: z.boolean().describe("一般の人が買える商品（食べ物・飲み物・お菓子・家電・コスメ・服など）の発売を、日付つきで報じている資料なら true。レポート・サービス・イベント・キャンペーン・企業向けの商品は false"),
  product: z
    .object({
      name: z.string().describe("商品名。資料に書かれている表記のまま（『』や「」は付けない）"),
      maker: z.string().nullable().describe("発売する会社・ブランド。資料に書かれていれば。なければ null"),
      date: z.string().describe("発売日 YYYY-MM-DD。日まで書かれているものだけ。年が書かれていなければ記事の日付から見て次に来るその日の年"),
      kind: z.enum(PRODUCT_KINDS).describe("food=グルメ・食品、sweets=スイーツ・お菓子、drink=飲み物、gadget=家電・ガジェット、beauty=コスメ・美容、fashion=服・雑貨、other=それ以外"),
    })
    .nullable()
    .describe("isRelease が true のときの情報。false なら null"),
});
export type ProductExtract = z.infer<typeof ProductExtractSchema>;

export const PRODUCT_EXTRACT_SYSTEM = `あなたはニュースの編集者です。資料（記事の見出しと短い要約）だけを根拠に、「今週の新発売」の一覧に載せる新商品の情報を読み取ります。
- 一般の人が買える商品の発売だけを対象にする。レポート・サービス・イベント・キャンペーン・企業向けの商品は isRelease を false にする。
- 資料に書かれていることだけを使う。商品名・会社・発売日を推測しない。
- 商品名は資料の表記のまま。発売日は日まで書かれているものだけ（月だけなら isRelease を false）。`;

export function buildProductPrompt(articles: { publisher: string; publishedAt: Date; title: string; summary: string | null }[]) {
  const lines = articles.map((a, i) => `[${i + 1}] ${publisherLabel(a.publisher)}／${formatDateTime(a.publishedAt)}\n見出し: ${a.title}\n要約: ${a.summary ?? "（なし）"}`);
  return `次の資料から、新商品の発売の情報を読み取ってください。\n\n${lines.join("\n\n")}`;
}

const fold = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s「」『』]/g, "");

/** 資料と照らし合わせる。商品名が資料にそのまま書かれ、発売日（日まで）が資料にあるものだけ残す。会社名は資料になければ外す */
export function verifyProduct(p: NonNullable<ProductExtract["product"]> | null | undefined, sourceText: string): NonNullable<ProductExtract["product"]> | null {
  if (!p) return null;
  const name = p.name.trim().replace(/^[「『]|[」』]$/g, "");
  if (!name || [...name].length > 40) return null;
  const corpus = fold(sourceText);
  if (!corpus.includes(fold(name))) return null;
  const date = verifyDate(p.date, sourceText);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const maker = p.maker?.trim() && corpus.includes(fold(p.maker)) ? p.maker.trim() : null;
  return { name, maker, date, kind: p.kind };
}

export async function findProductCandidates(limit: number, now = new Date()) {
  const topics = await prisma.topic.findMany({
    where: { genre: { slug: { in: PRODUCT_GENRES } }, aiProductChecked: false, firstSeenAt: { gte: new Date(now.getTime() - CANDIDATE_DAYS * 86_400_000) } },
    orderBy: [{ score: "desc" }, { firstSeenAt: "desc" }],
    take: 800,
    select: { id: true, title: true, articles: { take: 3, orderBy: { publishedAt: "asc" }, select: { title: true, summary: true, publisher: true, publishedAt: true } } },
  });
  return topics.filter((t) => isProductCandidate([t.title, ...t.articles.map((a) => `${a.title} ${a.summary ?? ""}`)].join(" "))).slice(0, limit);
}

export async function saveProductExtract(topicId: number, result: ProductExtract) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { articles: { select: { title: true, summary: true } } } });
  if (!topic) throw new Error("topic not found");
  const corpus = topic.articles.map((a) => `${a.title}\n${a.summary ?? ""}`).join("\n");
  const product = result.isRelease ? verifyProduct(result.product, corpus) : null;
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      aiProductChecked: true,
      aiProductName: product?.name ?? null,
      aiProductMaker: product?.maker ?? null,
      aiProductDate: product?.date ?? null,
      aiProductKind: product?.kind ?? null,
    },
  });
  return { saved: product };
}

/** from〜to（YYYY-MM-DD、両端を含む）に発売される商品。同じ商品名は1件にまとめ、話題の大きい順 */
export async function getProducts(from: string, to: string): Promise<ProductItem[]> {
  const topics = await prisma.topic.findMany({
    where: { aiProductName: { not: null }, aiProductDate: { gte: from, lte: to } },
    orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
    take: 500,
    select: { id: true, aiProductName: true, aiProductMaker: true, aiProductDate: true, aiProductKind: true },
  });
  const seen = new Set<string>();
  const out: ProductItem[] = [];
  for (const t of topics) {
    const key = fold(t.aiProductName!);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ topicId: t.id, name: t.aiProductName!, maker: t.aiProductMaker, date: t.aiProductDate!, kind: (t.aiProductKind ?? "other") as ProductKind });
  }
  return out;
}

/** 日本時間の今週・来週（月曜はじまり）の範囲 YYYY-MM-DD */
export function jstWeeks(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  const dow = (jst.getUTCDay() + 6) % 7; // 月曜=0
  const monday = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - dow));
  const day = (offset: number) => new Date(monday.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  return { thisWeek: { from: day(0), to: day(6) }, nextWeek: { from: day(7), to: day(13) } };
}
