export type TopicSignals = {
  publisherCount: number;
  articleCount: number;
  socialCount: number;
  clicks: number;
  lastSeenAt: Date;
};

/**
 * トピックの話題度。報じた媒体数を主軸に、外部の話題シグナルとサイト内の閲覧数を加味し、
 * 時間経過で減衰させる（Hacker News 型の重力減衰）。
 */
export function topicScore(s: TopicSignals, now: Date = new Date()): number {
  const hours = Math.max(0, (now.getTime() - s.lastSeenAt.getTime()) / 3_600_000);
  const base =
    s.publisherCount * 1.0 +
    Math.max(0, s.articleCount - s.publisherCount) * 0.2 +
    Math.log1p(s.socialCount) * 0.8 +
    Math.log1p(s.clicks) * 0.6;
  return base / Math.pow(hours + 2, 1.3);
}
