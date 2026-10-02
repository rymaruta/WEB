/**
 * 新着動画を載せる YouTube のチャンネル（画面からも使うので DB に依存しない）。
 * 公式の新着情報（https://www.youtube.com/feeds/videos.xml?channel_id=...）から取り込む
 */

export type YouTubeChannel = {
  /** ページのアドレスに使う名前（/youtube/hikakin） */
  slug: string;
  /** YouTube のチャンネル ID */
  id: string;
  /** 表示名 */
  name: string;
  /** ニュースの見出しから、この人の話題を見分ける言葉（正規表現。JavaScript と PostgreSQL の両方で同じように動く形） */
  keywords: string;
};

export const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  { slug: "hikakin", id: "UCZf__ehlCEBPop-_sldpBUQ", name: "HIKAKIN（HikakinTV）", keywords: "ヒカキン|HIKAKIN|HikakinTV" },
  { slug: "hajime", id: "UCgMPP6RRjktV7krOfyUewqw", name: "はじめしゃちょー", keywords: "はじめしゃちょー" },
];

/** 動画のジャンル（題名と説明文から AI が判定する） */
export const VIDEO_CATEGORIES = ["challenge", "game", "review", "food", "collab", "vlog", "music", "other"] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];
export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  challenge: "検証・企画",
  game: "ゲーム",
  review: "商品紹介・レビュー",
  food: "料理・グルメ",
  collab: "コラボ",
  vlog: "日常・Vlog",
  music: "音楽",
  other: "そのほか",
};

export const findChannel = (slug: string) => YOUTUBE_CHANNELS.find((c) => c.slug === slug);
export const channelById = (id: string) => YOUTUBE_CHANNELS.find((c) => c.id === id);

export const youtubeWatchUrl = (videoId: string, isShort = false) => (isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`);
export const videoPath = (videoId: string) => `/youtube/v/${videoId}`;

/** 再生回数の表示（12.3万回、1,234回） */
export function viewsLabel(n: number): string {
  if (n >= 100_000_000) return `${Math.round(n / 10_000_000) / 10}億回`;
  if (n >= 10_000) return `${Math.round(n / 1000) / 10}万回`;
  return `${n.toLocaleString("ja-JP")}回`;
}
