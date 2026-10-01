import { prisma } from "@/lib/db";
import { classifierText, isTrainingFeed, MIXED_FEEDS, predictGenre, trainGenreModel, type GenreModel } from "./genre-classifier";

type Row = { title: string; summary: string | null; feedUrl: string; source: string; genre: string };

/** 媒体（フィード）ごとに直近 perSource 件の記事。ジャンルはフィードに付けたもの */
export async function loadLabeledArticles(days = 30, perSource = 800): Promise<Row[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  return prisma.$queryRaw<Row[]>`
    SELECT a.title, a.summary, s."feedUrl", s.name AS source, g.slug AS genre
    FROM (
      SELECT title, summary, "sourceId", ROW_NUMBER() OVER (PARTITION BY "sourceId" ORDER BY "publishedAt" DESC) AS rn
      FROM "Article" WHERE "publishedAt" >= ${since}
    ) a
    JOIN "Source" s ON s.id = a."sourceId" AND s.kind = 'NEWS'
    JOIN "Genre" g ON g.id = s."genreId"
    WHERE a.rn <= ${perSource}`;
}

/** 文字列から決まる 0〜99 の値（学習用と確認用に、毎回同じ分け方をするため） */
function bucket(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

const THRESHOLDS = [0.8, 0.9, 0.95, 0.99];

/**
 * 正答率を測る。特化したフィードの記事の2割を取り分けて当てさせる。
 * あわせて、混ざったフィードの記事がどう判定し直されるかの件数と実例を返す（分類は変えない）。
 */
export async function evaluateGenreClassifier(opts: { days?: number; perSource?: number } = {}) {
  const rows = await loadLabeledArticles(opts.days, opts.perSource);
  const doc = (r: Row) => ({ text: classifierText(r.title, r.summary), genre: r.genre });
  const train = rows.filter((r) => isTrainingFeed(r.feedUrl, r.genre) && bucket(r.title) >= 20);
  const test = rows.filter((r) => !MIXED_FEEDS.has(r.feedUrl) && bucket(r.title) < 20);
  const model = trainGenreModel(train.map(doc));

  const perClass = new Map<string, { n: number; correct: number; predicted: number; predictedCorrect: number }>();
  const confusion = new Map<string, number>();
  const atThreshold = THRESHOLDS.map((t) => ({ threshold: t, covered: 0, correct: 0 }));
  let correct = 0;
  let judged = 0;
  for (const r of test) {
    const p = predictGenre(model, doc(r).text);
    if (!p) continue;
    judged++;
    const c = perClass.get(r.genre) ?? { n: 0, correct: 0, predicted: 0, predictedCorrect: 0 };
    c.n++;
    perClass.set(r.genre, c);
    const pc = perClass.get(p.slug) ?? { n: 0, correct: 0, predicted: 0, predictedCorrect: 0 };
    pc.predicted++;
    perClass.set(p.slug, pc);
    if (p.slug === r.genre) {
      correct++;
      c.correct++;
      pc.predictedCorrect++;
    } else confusion.set(`${r.genre}→${p.slug}`, (confusion.get(`${r.genre}→${p.slug}`) ?? 0) + 1);
    for (const a of atThreshold) {
      if (p.prob >= a.threshold) {
        a.covered++;
        if (p.slug === r.genre) a.correct++;
      }
    }
  }

  return {
    trainDocs: train.length,
    testDocs: test.length,
    judged,
    accuracy: round(correct / judged),
    thresholds: atThreshold.map((a) => ({ threshold: a.threshold, coverage: round(a.covered / judged), precision: round(a.correct / a.covered) })),
    perClass: Object.fromEntries(
      [...perClass].map(([g, c]) => [g, { n: c.n, recall: round(c.correct / c.n), precision: round(c.predictedCorrect / c.predicted) }]),
    ),
    topConfusions: [...confusion].sort((a, b) => b[1] - a[1]).slice(0, 12),
    mixedFeeds: mixedFeedReport(model, rows),
  };
}

const round = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);

/** 混ざったフィードごとに、判定し直すと何件がどのジャンルに移るか（確率 0.9 以上のとき） */
function mixedFeedReport(model: GenreModel, rows: Row[]) {
  const bySource = new Map<string, Row[]>();
  for (const r of rows) if (MIXED_FEEDS.has(r.feedUrl)) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
  return [...bySource].map(([source, list]) => {
    const moved = new Map<string, number>();
    const examples: string[] = [];
    for (const r of list) {
      const p = predictGenre(model, classifierText(r.title, r.summary));
      if (!p || p.prob < 0.9 || p.slug === r.genre) continue;
      moved.set(p.slug, (moved.get(p.slug) ?? 0) + 1);
      if (examples.length < 8) examples.push(`${r.genre}→${p.slug} (${p.prob.toFixed(2)}) ${r.title.slice(0, 50)}`);
    }
    return { source, feedGenre: list[0].genre, articles: list.length, moved: Object.fromEntries(moved), examples };
  });
}
