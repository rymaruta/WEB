import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { GENRE_SLUGS } from "@/lib/ai/prompt";
import { logEvent } from "@/lib/events";
import { refreshTopics } from "./cluster";
import { checkMerge } from "./merge-check";

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
        confidence: z.number().min(0).max(1).optional().describe("genre の確からしさ（0〜1）。0.6 未満なら genre は使わない"),
        reason: z.string().max(80).optional().describe("genre の根拠（例: 俳優の結婚の話題のため）"),
        sameAs: z
          .number()
          .int()
          .nullable()
          .optional()
          .describe("topics または context の別の話題と同じ出来事・同じ騒動なら、その話題の id。違えば null"),
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
- tech: IT・ネットサービス・AI・科学、スマホ・タブレット・パソコン・電子書籍端末などのデジタル機器（新製品の発表も tech）
- entertainment: 芸能人・映画・音楽・テレビ番組・お笑い
- sports: スポーツ
- game: ゲーム（家庭用・PC・スマホのゲーム、ゲーム機、e スポーツ）
- anime: アニメ・漫画・声優の作品そのものの話題（放送・連載・映画化・キャスト・制作）
- products: 新商品・グルメ・新しいお店（食品・飲料・生活家電・日用品・ファッション）、キャラクターグッズ・くじ・コラボ商品
- life: 暮らしの知恵・お金の節約・健康・旅行・車・ネットで話題の身近な出来事

決め方:
- 芸能人の話題は、経済誌が報じていても entertainment。スポーツ選手の結婚・熱愛も entertainment
- キャラクターグッズ・くじ・コンビニのおまけ・コラボ商品は products（作品の話題でない限り anime・game にしない）
- ゲームの中のコラボ・イベント・アップデートは game
- 企業の出店・休業・販売休止・提携など、企業の経営の判断は business（商品そのものの紹介でない限り）
- 音楽の配信ランキング・アーティストの話題は entertainment
- 便利な道具・家電の使い方や体験談は life
- ゲームが題材のグッズ・食品は products、ゲームそのものの話題だけを game にする
- 政治家の発言でも、海外の出来事が中心なら world
- どれとも決めにくい場合は genre を null にする
- confidence に確からしさ（0〜1）、reason に根拠を短く書く。0.6 未満の判定は使われない
- hint がある話題は、自動の判定が別のジャンルを示したもの。内容を読み直して決める（hint に合わせる必要はない）

notNews（読み物でない告知）を true にするのは、次のようなものだけ:
- 占い・運勢、求人や採用イベント、株主・投資家向けの説明会やセミナーの案内、展示会・講演会の出展や登壇の告知
- 自治体・団体の行事の案内、企業の小さな社内人事・組織変更・提携・受賞・認証取得のお知らせ
- 企業の統合報告書・IR 資料の公開、寄付・義援金のお知らせ
事件・事故・新商品・業績・サービスの開始や終了など、読者が知りたい出来事は false にする。迷う場合は false。

sameAs（同じ出来事の話題をまとめる）:
- topics と context（すでに一覧に出ている話題）の中に、同じ出来事・同じ騒動を扱う話題があれば、その id を入れる
  （例: 同じ人の逮捕・契約解除・謝罪会見・それへの反応、同じ試合の結果と監督のコメント、同じ発表の別の媒体の記事）
- 同じ人や会社の話題でも、別の出来事（別の日の別の発表、別の試合など）なら null
- 迷う場合は null`;

export type GenreCheckCandidate = {
  id: number;
  genre: string;
  title: string;
  articles: { publisher: string; title: string; summary: string | null }[];
  /** 見直しの依頼（ルールの判定が前の AI の判定と強く食い違った話題） */
  hint?: string;
};

/** AI の判定として使う確からしさの下限 */
export const AI_MIN_CONFIDENCE = 0.6;

/** 同じ出来事かを見比べるための、すでに判定した一覧の上位の話題（ジャンルごと） */
const CONTEXT_PER_GENRE = 10;

export async function findMergeContext(excludeIds: number[], now = new Date()): Promise<{ id: number; genre: string; title: string }[]> {
  const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000);
  return prisma.$queryRaw<{ id: number; genre: string; title: string }[]>`
    SELECT id, genre, title FROM (
      SELECT t.id, g.slug AS genre, COALESCE(t."aiTitle", t.title) AS title,
             row_number() OVER (PARTITION BY t."genreId" ORDER BY t.score DESC) AS rn
      FROM "Topic" t JOIN "Genre" g ON g.id = t."genreId"
      WHERE t."lastSeenAt" >= ${since} AND t."mergedIntoId" IS NULL AND NOT t."aiNotNews"
        AND (t."aiGenreChecked" OR t."aiGenreId" IS NOT NULL)
        AND NOT (t.id = ANY(${excludeIds}))
    ) x
    WHERE rn <= ${CONTEXT_PER_GENRE}
    ORDER BY genre, rn`;
}

/** 判定する話題。一覧の上位（話題度順）から、まだ判定していないものをジャンルごとに少しずつ */
export async function findGenreCheckCandidates(limit = GENRE_CHECK_LIMIT, now = new Date()): Promise<GenreCheckCandidate[]> {
  const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000);
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM (
      SELECT t.id, t.score, row_number() OVER (PARTITION BY t."genreId" ORDER BY t.score DESC, t."lastSeenAt" DESC) AS rn
      FROM "Topic" t
      WHERE t."lastSeenAt" >= ${since} AND NOT t."aiGenreChecked" AND t."aiGenreId" IS NULL AND t."mergedIntoId" IS NULL
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
      genreNote: true,
      articles: { take: 2, orderBy: [{ publishedAt: "asc" }, { id: "asc" }], select: { publisher: true, title: true, summary: true } },
    },
  });
  const byId = new Map(topics.map((t) => [t.id, t]));
  return rows
    .map((r) => byId.get(r.id))
    .filter((t) => !!t)
    .map((t) => ({
      id: t.id,
      genre: t.genre.slug,
      title: t.title,
      articles: t.articles.map((a) => ({ ...a, summary: a.summary?.slice(0, 120) ?? null })),
      ...(t.genreNote?.startsWith("recheck ") ? { hint: `ルールによる判定（前回の AI の判定と食い違い）: ${t.genreNote.slice(8, 160)}` } : {}),
    }));
}

/**
 * 判定の結果を保存する。ジャンルは aiGenreId にも入れ、記事が増えて集計し直しても戻らないようにする。
 * 「読み物でない告知」の印は、報じた報道機関が1社までの話題にしか付けない
 * （複数の媒体が報じた出来事を一覧から消してしまわないように。1社だけなのは、総合ニュースサイトが占いや企業の発表を
 * そのまま載せることがあるため）。
 * 同じ出来事の話題（sameAs）は1つにまとめる（mergeTopics）
 */
export async function saveGenreChecks(results: GenreCheck["results"]): Promise<{ saved: number; moved: number; hidden: number; merged: number }> {
  if (results.length === 0) return { saved: 0, moved: 0, hidden: 0, merged: 0 };
  const genres = await prisma.genre.findMany({ select: { id: true, slug: true } });
  const genreId = new Map(genres.map((g) => [g.slug, g.id]));
  const ids = [...new Set(results.map((r) => r.id))];
  const topics = await prisma.topic.findMany({
    where: { id: { in: ids } },
    select: { id: true, genreId: true, genreNote: true, articles: { where: { source: { kind: "NEWS" } }, distinct: ["publisher"], take: 2, select: { publisher: true } } },
  });
  const known = new Map(topics.map((t) => [t.id, t]));
  let moved = 0;
  let hidden = 0;
  const rows: Prisma.Sql[] = [];
  for (const r of results) {
    const t = known.get(r.id);
    if (!t) continue;
    // 確からしさの低い判定は使わない（今のジャンルのまま）
    const sure = r.confidence === undefined || r.confidence >= AI_MIN_CONFIDENCE;
    const gid = r.genre && sure ? (genreId.get(r.genre) ?? null) : null;
    // 判定の記録。見直しの依頼に答えたものは ai-final（以後ルールで変えない）
    const method = t.genreNote?.startsWith("recheck ") ? "ai-final" : "ai";
    const note = `${method} ${gid ? r.genre : "keep"} conf=${r.confidence ?? "-"} ${r.reason ?? ""}`.trim().slice(0, 500);
    const notNews = r.notNews && t.articles.length < 2;
    if (gid && gid !== t.genreId) moved++;
    if (notNews) hidden++;
    rows.push(Prisma.sql`(${t.id}::int, ${gid}::int, ${notNews}::boolean, ${note}::text)`);
  }
  if (rows.length > 0) {
    await prisma.$executeRaw`
      UPDATE "Topic" t
      SET "aiGenreChecked" = true,
          "aiNotNews" = v.not_news,
          "aiGenreId" = COALESCE(v.gid, t."aiGenreId"),
          "genreId" = COALESCE(v.gid, t."genreId"),
          "genreNote" = v.note
      FROM (VALUES ${Prisma.join(rows)}) AS v(id, gid, not_news, note)
      WHERE t.id = v.id`;
  }
  const pairs = results.filter((r) => known.has(r.id) && r.sameAs && r.sameAs !== r.id).map((r) => [r.id, r.sameAs!] as const);
  const merged = await mergeTopics(pairs);
  return { saved: rows.length, moved, hidden, merged };
}

/** まとめる先を選ぶ。AI まとめ記事があるほう、報じた媒体の多いほう、先にできたほうの順 */
export function pickKeeper<T extends { id: number; publisherCount: number; aiGeneratedAt: Date | null }>(a: T, b: T): [keep: T, drop: T] {
  const rank = (t: T) => [t.aiGeneratedAt ? 1 : 0, t.publisherCount, -t.id];
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] > rb[i] ? [a, b] : [b, a];
  return [a, b];
}

/**
 * 同じ出来事の話題を1つにまとめる。まとめた側の記事はすべて残す側へ移し、まとめた側には移した先を記録する
 * （一覧には出さず、ページはまとめた先へ移す）。一覧に出る期間の、まだまとめていない話題どうしだけ。
 * - AI の判定（source: "ai"）は、見出しに共通の固有の語があり、時期が近いものだけまとめる（checkMerge）。運営者の指示はそのまま
 * - まとめた記録（移した記事）を TopicMerge に残し、undoMerge で取り消せる
 */
export async function mergeTopics(
  pairs: readonly (readonly [number, number])[],
  now = new Date(),
  opts: { source?: "ai" | "admin" } = {},
): Promise<number> {
  if (pairs.length === 0) return 0;
  const source = opts.source ?? "ai";
  const since = new Date(now.getTime() - WINDOW_HOURS * 3_600_000);
  const ids = [...new Set(pairs.flat())];
  const rows = await prisma.topic.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, firstSeenAt: true, publisherCount: true, aiGeneratedAt: true, aiNotNews: true, mergedIntoId: true, lastSeenAt: true },
  });
  const byId = new Map(rows.map((t) => [t.id, t]));
  const done = new Set<number>();
  let merged = 0;
  for (const [x, y] of pairs) {
    const a = byId.get(x);
    const b = byId.get(y);
    if (!a || !b || done.has(a.id) || done.has(b.id) || a.mergedIntoId || b.mergedIntoId) continue;
    if (a.lastSeenAt < since || b.lastSeenAt < since) continue;
    const check = checkMerge(a, b);
    if (source === "ai" && !check.ok) {
      await logEvent("info", "topic.merge-rejected", `${a.id} と ${b.id} はまとめない（${check.reason}）: ${a.title.slice(0, 40)} / ${b.title.slice(0, 40)}`);
      continue;
    }
    const [keep, drop] = pickKeeper(a, b);
    const moved = await prisma.article.findMany({ where: { topicId: drop.id }, select: { id: true } });
    await prisma.$transaction([
      prisma.article.updateMany({ where: { topicId: drop.id }, data: { topicId: keep.id } }),
      prisma.topic.update({ where: { id: drop.id }, data: { mergedIntoId: keep.id, aiNotNews: true } }),
      prisma.topicMerge.create({
        data: { keepId: keep.id, dropId: drop.id, articleIds: moved.map((m) => m.id), dropWasNotNews: drop.aiNotNews, source, reason: check.reason },
      }),
    ]);
    // まとめた側の記事を、残す側の件数・媒体数・見出しに反映する
    await refreshTopics([keep.id]);
    done.add(drop.id);
    merged++;
  }
  return merged;
}

/** まとめたのを取り消す。移した記事を元の話題へ戻し、元の話題を一覧に戻す */
export async function undoMerge(mergeId: number): Promise<{ ok: boolean; error?: string; restored?: number }> {
  const m = await prisma.topicMerge.findUnique({ where: { id: mergeId } });
  if (!m) return { ok: false, error: "merge not found" };
  if (m.undoneAt) return { ok: false, error: "already undone" };
  const drop = await prisma.topic.findUnique({ where: { id: m.dropId }, select: { mergedIntoId: true } });
  if (!drop) return { ok: false, error: "dropped topic no longer exists" };
  const [restored] = await prisma.$transaction([
    // 残した側にまだある記事だけを戻す（その後さらに別の話題へまとめられた記事は動かさない）
    prisma.article.updateMany({ where: { id: { in: m.articleIds }, topicId: m.keepId }, data: { topicId: m.dropId } }),
    prisma.topic.update({ where: { id: m.dropId }, data: { mergedIntoId: null, aiNotNews: m.dropWasNotNews } }),
    prisma.topicMerge.update({ where: { id: m.id }, data: { undoneAt: new Date() } }),
  ]);
  await refreshTopics([m.keepId, m.dropId]);
  await logEvent("info", "topic.merge-undone", `${m.keepId} から ${m.dropId} を戻した（記事 ${restored.count} 件）`);
  return { ok: true, restored: restored.count };
}
