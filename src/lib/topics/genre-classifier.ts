import { bigrams } from "./similarity";

/**
 * 見出し（と要約の冒頭）から記事のジャンルを当てる、単純ベイズ分類器。
 * ジャンルの混ざったフィード（マイナビニュース、各社の「主要」「速報」など）は、フィードに付けたジャンルが
 * 記事の内容と合わないことがある（例: マイナビニュース＝IT・科学 に、サッカーの記事が入る）。
 * 1つのジャンルに特化したフィードの記事を教材に学習し、混ざったフィードの記事だけを判定し直す。
 * 外部サービスは使わず、サーバーの中で学習する。
 */

/** ジャンルが混ざっていて、記事ごとに判定し直すフィード（feedUrl） */
export const MIXED_FEEDS = new Set([
  "https://news.mynavi.jp/rss/index",
  "https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml",
  "https://gigazine.net/news/rss_2.0/",
  "https://news.livedoor.com/topics/rss/top.xml",
  "https://www.j-cast.com/index.xml",
  "https://www.jiji.com/rss/ranking.rdf",
  "https://www.asahi.com/rss/asahi/newsheadlines.rdf",
  "https://mainichi.jp/rss/etc/mainichi-flash.rss",
  "https://news.ntv.co.jp/rss/index.rdf",
  "https://newsdig.tbs.co.jp/list/feed/rss",
  "https://www.huffingtonpost.jp/feeds/index.xml",
  "https://bunshun.jp/list/feed/rss",
  "https://www.tokyo-sports.co.jp/list/feed/rss",
  "https://hochi.news/rss/index.xml",
  "https://rss.itmedia.co.jp/rss/2.0/netlab.xml",
  "https://sirabee.com/feed/",
  "https://wedge.ismedia.jp/list/feed/rss",
]);

/**
 * 教材にするか。特化したフィードの記事は教材にする。混ざったフィードは原則使わないが、
 * 「国内」は特化したフィードがほとんどないため、国内のフィードは混ざっていても教材にする
 * （スポーツなど他のジャンルの語は、特化したフィードで学んだジャンルのほうが強く効く）。
 */
export function isTrainingFeed(feedUrl: string, genreSlug: string): boolean {
  return !MIXED_FEEDS.has(feedUrl) || genreSlug === "domestic";
}

/** 判定に使う文字列（見出し＋要約の冒頭） */
export function classifierText(title: string, summary?: string | null): string {
  return `${title} ${(summary ?? "").slice(0, 120)}`;
}

export type GenreModel = {
  classes: string[];
  /** 語（文字の2字組）ごとの、ジャンル別の対数確率 */
  logProb: Map<string, Float64Array>;
  /** 学習に出てこなかった語の、ジャンル別の対数確率 */
  unseen: Float64Array;
  docs: number;
};

export type Prediction = { slug: string; prob: number; second: string; secondProb: number };

/**
 * 学習する。ジャンルごとの記事数の差で判定が偏らないよう、事前確率は均等にする。
 * minCount 未満の文書にしか出ない語は捨てる（教材の偶然に引きずられないように）。
 */
export function trainGenreModel(docs: { text: string; genre: string }[], minCount = 3): GenreModel {
  const classes = [...new Set(docs.map((d) => d.genre))].sort();
  const idx = new Map(classes.map((c, i) => [c, i]));
  const counts = new Map<string, Float64Array>();
  const df = new Map<string, number>();
  for (const d of docs) {
    const c = idx.get(d.genre)!;
    const grams = new Set(bigrams(d.text));
    for (const g of grams) {
      df.set(g, (df.get(g) ?? 0) + 1);
      let row = counts.get(g);
      if (!row) counts.set(g, (row = new Float64Array(classes.length)));
      row[c] += 1;
    }
  }
  const totals = new Float64Array(classes.length);
  for (const [g, row] of counts) {
    if ((df.get(g) ?? 0) < minCount) {
      counts.delete(g);
      continue;
    }
    for (let i = 0; i < classes.length; i++) totals[i] += row[i];
  }
  const vocab = counts.size;
  const logProb = new Map<string, Float64Array>();
  for (const [g, row] of counts) {
    const lp = new Float64Array(classes.length);
    for (let i = 0; i < classes.length; i++) lp[i] = Math.log((row[i] + 1) / (totals[i] + vocab));
    logProb.set(g, lp);
  }
  const unseen = new Float64Array(classes.length);
  for (let i = 0; i < classes.length; i++) unseen[i] = Math.log(1 / (totals[i] + vocab));
  return { classes, logProb, unseen, docs: docs.length };
}

export function predictGenre(model: GenreModel, text: string): Prediction | null {
  const scores = new Float64Array(model.classes.length);
  let known = 0;
  for (const g of new Set(bigrams(text))) {
    const lp = model.logProb.get(g);
    if (!lp) continue;
    known++;
    for (let i = 0; i < scores.length; i++) scores[i] += lp[i];
  }
  if (known < 3) return null;
  const max = Math.max(...scores);
  const exp = [...scores].map((s) => Math.exp(s - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  const ranked = exp.map((e, i) => ({ slug: model.classes[i], prob: e / sum })).sort((a, b) => b.prob - a.prob);
  return { slug: ranked[0].slug, prob: ranked[0].prob, second: ranked[1]?.slug ?? "", secondProb: ranked[1]?.prob ?? 0 };
}

/** 判定し直すときの基準。この確率以上で当てたときだけ、フィードのジャンルを上書きする */
export const RECLASSIFY_MIN_PROB = 0.9;

/**
 * 判定し直してよいジャンル。正答率を測って、当てたものがほぼ正しいジャンルだけに絞る
 * （2026-10-02 の測定: スポーツは「スポーツ」と判定したものの 98.8% が正解。他は 70% 台で、まだ使わない）。
 * 記事がたまって精度が上がったら、/api/admin/genre-classifier で測り直して広げる。
 */
export const RECLASSIFY_TARGETS: ReadonlySet<string> = new Set(["sports"]);

/** 混ざったフィードの記事のジャンル。自信がなければフィードのジャンルのまま */
export function reclassify(
  model: GenreModel | null,
  feedUrl: string,
  feedGenre: string,
  text: string,
  opts: { minProb?: number; targets?: ReadonlySet<string> } = {},
): string {
  if (!model || !MIXED_FEEDS.has(feedUrl)) return feedGenre;
  const p = predictGenre(model, text);
  if (!p || p.prob < (opts.minProb ?? RECLASSIFY_MIN_PROB)) return feedGenre;
  return (opts.targets ?? RECLASSIFY_TARGETS).has(p.slug) ? p.slug : feedGenre;
}
