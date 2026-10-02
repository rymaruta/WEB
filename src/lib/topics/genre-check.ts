import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { GENRE_SLUGS } from "@/lib/ai/prompt";

/**
 * 話題のジャンルを、内容から判定し直す。
 * ジャンルはふだん「どの媒体のどの欄に載ったか」で決まるため、総合誌（東洋経済・プレジデントなど）や
 * 総合ニュースの欄の記事は、内容と違うジャンルに入りやすい（例: 経済の一覧に芸能人の衣装ランキング）。
 * 一覧の上位に出る話題を記事作成の定期処理がまとめて読み、ジャンルを付け直す。
 * あわせて、読み物でない告知（占い・求人など）に印を付け、一覧に出さないようにする。
 */

/** 1回に判定する話題の数と、ジャンルごとの上限（どのジャンルの一覧も少しずつ整うように） */
export const GENRE_CHECK_LIMIT = 120;
const PER_GENRE = 15;
/** 一覧に出る期間の話題だけを判定する */
const WINDOW_HOURS = 48;

export const GenreCheckSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().int(),
        genre: z.enum(GENRE_SLUGS).nullable().describe("出来事の内容で決めるジャンル。迷う場合は null（今のジャンルのまま）"),
        notNews: z.boolean().describe("読み物でない告知なら true"),
      }),
    )
    .describe("受け取ったすべての話題について1件ずつ"),
});

export type GenreCheck = z.infer<typeof GenreCheckSchema>;

export const GENRE_CHECK_SYSTEM = `あなたはニュースサイトの編集者です。話題ごとの見出しと短い要約を読み、どのジャンルの一覧に載せるかを決めます。

ジャンル（どの媒体が報じたかではなく、何についての出来事かで決める）:
- domestic: 国内の政治・社会・事件・事故・災害
- world: 海外の出来事・国際関係
- business: 経済・企業の経営や業績・市場・金融・雇用
- tech: IT・ネットサービス・AI・スマホやパソコン・科学
- entertainment: 芸能人・映画・音楽・テレビ番組・お笑い
- sports: スポーツ
- game: ゲーム（家庭用・PC・スマホのゲーム、ゲーム機、e スポーツ）
- anime: アニメ・漫画・声優の作品情報（キャラクターグッズの発売もここ）
- products: 新商品・グルメ・新しいお店（食品・飲料・家電・日用品・ファッション）
- life: 暮らしの知恵・お金の節約・健康・旅行・車・ネットで話題の身近な出来事

決め方:
- 芸能人の話題は、経済誌が報じていても entertainment。コンビニのおまけやキャラクターグッズは products か anime で、tech や game にはしない
- ゲームが題材のグッズ・食品は products、ゲームそのものの話題だけを game にする
- 政治家の発言でも、海外の出来事が中心なら world
- どれとも決めにくい場合は genre を null にする

notNews（読み物でない告知）を true にするのは、次のようなものだけ:
- 占い・運勢、求人や採用イベント、株主・投資家向けの説明会やセミナーの案内、展示会・講演会の出展や登壇の告知
- 自治体・団体の行事の案内、企業の小さな社内人事・組織変更・提携・受賞・認証取得のお知らせ
事件・事故・新商品・業績・サービスの開始や終了など、読者が知りたい出来事は false にする。迷う場合は false。`;

export type GenreCheckCandidate = { id: number; genre: string; title: string; articles: { publisher: string; title: string; summary: string | null }[] };

/** 判定する話題。一覧の上位（話題度順）から、まだ判定していないものをジャンルごとに少しずつ */
export async function findGenreCheckCandidates(limit = GENRE_CHECK_LIMIT, now = new Date()): Promise<GenreCheckCandidate[]> {
  const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000);
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM (
      SELECT t.id, t.score, row_number() OVER (PARTITION BY t."genreId" ORDER BY t.score DESC, t."lastSeenAt" DESC) AS rn
      FROM "Topic" t
      WHERE t."lastSeenAt" >= ${since} AND NOT t."aiGenreChecked" AND t."aiGenreId" IS NULL
    ) x
    WHERE rn <= ${PER_GENRE}
    ORDER BY rn, score DESC
    LIMIT ${limit}`;
  if (rows.length === 0) return [];
  const topics = await prisma.topic.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: {
      id: true,
      title: true,
      genre: { select: { slug: true } },
      articles: { take: 2, orderBy: [{ publishedAt: "asc" }, { id: "asc" }], select: { publisher: true, title: true, summary: true } },
    },
  });
  const byId = new Map(topics.map((t) => [t.id, t]));
  return rows
    .map((r) => byId.get(r.id))
    .filter((t) => !!t)
    .map((t) => ({ id: t.id, genre: t.genre.slug, title: t.title, articles: t.articles.map((a) => ({ ...a, summary: a.summary?.slice(0, 120) ?? null })) }));
}

/**
 * 判定の結果を保存する。ジャンルは aiGenreId にも入れ、記事が増えて集計し直しても戻らないようにする。
 * 「読み物でない告知」の印は、報道機関の記事が1本もない話題（企業の発表・SNS だけ）にしか付けない
 * （報じられた出来事を一覧から消してしまわないように）
 */
export async function saveGenreChecks(results: GenreCheck["results"]): Promise<{ saved: number; moved: number; hidden: number }> {
  if (results.length === 0) return { saved: 0, moved: 0, hidden: 0 };
  const genres = await prisma.genre.findMany({ select: { id: true, slug: true } });
  const genreId = new Map(genres.map((g) => [g.slug, g.id]));
  const ids = [...new Set(results.map((r) => r.id))];
  const topics = await prisma.topic.findMany({
    where: { id: { in: ids } },
    select: { id: true, genreId: true, articles: { where: { source: { kind: "NEWS" } }, take: 1, select: { id: true } } },
  });
  const known = new Map(topics.map((t) => [t.id, t]));
  let moved = 0;
  let hidden = 0;
  const rows: Prisma.Sql[] = [];
  for (const r of results) {
    const t = known.get(r.id);
    if (!t) continue;
    const gid = r.genre ? (genreId.get(r.genre) ?? null) : null;
    const notNews = r.notNews && t.articles.length === 0;
    if (gid && gid !== t.genreId) moved++;
    if (notNews) hidden++;
    rows.push(Prisma.sql`(${t.id}::int, ${gid}::int, ${notNews}::boolean)`);
  }
  if (rows.length === 0) return { saved: 0, moved: 0, hidden: 0 };
  await prisma.$executeRaw`
    UPDATE "Topic" t
    SET "aiGenreChecked" = true,
        "aiNotNews" = v.not_news,
        "aiGenreId" = COALESCE(v.gid, t."aiGenreId"),
        "genreId" = COALESCE(v.gid, t."genreId")
    FROM (VALUES ${Prisma.join(rows)}) AS v(id, gid, not_news)
    WHERE t.id = v.id`;
  return { saved: rows.length, moved, hidden };
}
