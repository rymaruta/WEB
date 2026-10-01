import { prisma } from "@/lib/db";
import { classifierText, isTrainingFeed, MIXED_FEEDS, reclassify, trainGenreModel, type GenreModel } from "./genre-classifier";
import { loadLabeledArticles } from "./genre-eval";

/** 学習し直す間隔。記事は日々増えるので、1日1回学習し直す */
const RETRAIN_MS = 24 * 3_600_000;

let cached: { model: GenreModel; at: number } | null = null;
let training: Promise<GenreModel> | null = null;

/** 学習済みのモデル（なければ学習する）。学習に失敗したら null（フィードのジャンルのまま使う） */
export async function getGenreModel(): Promise<GenreModel | null> {
  if (cached && Date.now() - cached.at < RETRAIN_MS) return cached.model;
  training ??= loadLabeledArticles(30, 800)
    .then((rows) => trainGenreModel(rows.filter((r) => isTrainingFeed(r.feedUrl, r.genre)).map((r) => ({ text: classifierText(r.title, r.summary), genre: r.genre }))))
    .finally(() => (training = null));
  try {
    const model = await training;
    cached = { model, at: Date.now() };
    return model;
  } catch (e) {
    console.error(JSON.stringify({ event: "genre-model", level: "error", message: e instanceof Error ? e.message : String(e) }));
    return cached?.model ?? null;
  }
}

/** 記事のジャンル（ID）を決める関数。混ざったフィードだけ見出しから判定し直す */
export async function genreResolver() {
  const genres = await prisma.genre.findMany({ select: { id: true, slug: true } });
  const slugOf = new Map(genres.map((g) => [g.id, g.slug]));
  const idOf = new Map(genres.map((g) => [g.slug, g.id]));
  const model = await getGenreModel();
  return (source: { feedUrl: string; genreId: number }, title: string, summary?: string | null): number => {
    if (!MIXED_FEEDS.has(source.feedUrl)) return source.genreId;
    const feedGenre = slugOf.get(source.genreId) ?? "";
    const slug = reclassify(model, source.feedUrl, feedGenre, classifierText(title, summary));
    return idOf.get(slug) ?? source.genreId;
  };
}

/**
 * 直近 days 日の、混ざったフィードの記事のジャンルを判定し直し、変わった記事の話題のジャンルを数え直す。
 * dryRun なら変えずに件数だけ返す。
 */
export async function reclassifyRecent(days = 7, dryRun = false) {
  const { refreshTopics } = await import("./cluster");
  const genreOf = await genreResolver();
  const articles = await prisma.article.findMany({
    where: { publishedAt: { gte: new Date(Date.now() - days * 86_400_000) }, source: { feedUrl: { in: [...MIXED_FEEDS] } } },
    select: { id: true, title: true, summary: true, genreId: true, topicId: true, source: { select: { feedUrl: true, genreId: true } } },
  });
  const changes = articles
    .map((a) => ({ a, genreId: genreOf(a.source, a.title, a.summary) }))
    .filter(({ a, genreId }) => genreId !== a.genreId);
  if (!dryRun) {
    const byGenre = new Map<number, number[]>();
    for (const c of changes) byGenre.set(c.genreId, [...(byGenre.get(c.genreId) ?? []), c.a.id]);
    for (const [genreId, ids] of byGenre) await prisma.article.updateMany({ where: { id: { in: ids } }, data: { genreId } });
    const topicIds = [...new Set(changes.map((c) => c.a.topicId).filter((t): t is number => t !== null))];
    if (topicIds.length) await refreshTopics(topicIds);
  }
  return {
    checked: articles.length,
    changed: changes.length,
    dryRun,
    examples: changes.slice(0, 15).map((c) => `${c.a.genreId}→${c.genreId} ${c.a.title.slice(0, 50)}`),
  };
}
