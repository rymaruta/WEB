export type TopicSignals = {
  /** 報じた媒体数（企業プレスリリースは除く） */
  publisherCount: number;
  articleCount: number;
  socialCount: number;
  clicks: number;
  lastSeenAt: Date;
  /** ジャンル（広く読まれる出来事かどうかの重み付けに使う） */
  genreSlug?: string;
  /** 報道機関（NEWS）の記事の数。0 なら、SNS のまとめや企業のお知らせだけの話題 */
  newsArticles?: number;
};

/**
 * 報道機関の記事がない話題（SNS のまとめ投稿や企業のお知らせだけ）の重み。消さずに、話題順で下に回す。
 * SNS の話題は反応の数が大きく、そのままだと報道されたニュースより上に来てしまうため
 */
const NO_NEWS_WEIGHT = 0.3;

/**
 * ジャンルごとの重み。ゲーム・アニメや新商品は、専門媒体が同じ告知を一斉に載せやすく、
 * 媒体数のわりに多くの読者にとっての重要度は高くないため控えめにする。
 */
const GENRE_WEIGHT: Record<string, number> = {
  game: 0.6,
  anime: 0.6,
  products: 0.6,
  entertainment: 0.85,
  life: 0.85,
};

/**
 * トピックの話題度。報じた媒体数を主軸に、外部の話題シグナルとサイト内の閲覧数を加味し、
 * 時間経過で減衰させる（Hacker News 型の重力減衰）。
 * 媒体数は 1.4 乗にして、多くの媒体が報じた大きな出来事が、2媒体だけの新しい話題に埋もれないようにする。
 */
export function topicScore(s: TopicSignals, now: Date = new Date()): number {
  const hours = Math.max(0, (now.getTime() - s.lastSeenAt.getTime()) / 3_600_000);
  const base =
    Math.pow(s.publisherCount, 1.4) +
    Math.max(0, s.articleCount - s.publisherCount) * 0.2 +
    Math.log1p(s.socialCount) * 0.8 +
    Math.log1p(s.clicks) * 0.6;
  const weight = ((s.genreSlug && GENRE_WEIGHT[s.genreSlug]) || 1) * (s.newsArticles === 0 ? NO_NEWS_WEIGHT : 1);
  return (base * weight) / Math.pow(hours + 2, 1.3);
}
