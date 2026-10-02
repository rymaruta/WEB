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
  /** YouTuber の分類（一覧のタブに使う） */
  group: ChannelGroup;
};

export const CHANNEL_GROUPS = ["entertainment", "game", "food", "learn", "vtuber"] as const;
export type ChannelGroup = (typeof CHANNEL_GROUPS)[number];
export const CHANNEL_GROUP_LABELS: Record<ChannelGroup, string> = { entertainment: "エンタメ", game: "ゲーム", food: "料理", learn: "学び", vtuber: "VTuber" };

export const YOUTUBE_CHANNELS: YouTubeChannel[] = [
  { slug: "hikakin", id: "UCZf__ehlCEBPop-_sldpBUQ", name: "HIKAKIN（HikakinTV）", keywords: "ヒカキン|HIKAKIN|HikakinTV", group: "entertainment" },
  { slug: "hajime", id: "UCgMPP6RRjktV7krOfyUewqw", name: "はじめしゃちょー", keywords: "はじめしゃちょー", group: "entertainment" },
  { slug: "fischers", id: "UCibEhpu5HP45-w7Bq1ZIulw", name: "フィッシャーズ", keywords: "フィッシャーズ|Fischer's", group: "entertainment" },
  { slug: "tokaionair", id: "UCutJqz56653xV2wwSvut_hQ", name: "東海オンエア", keywords: "東海オンエア", group: "entertainment" },
  { slug: "comdot", id: "UCRxPrFmRHsXGWfAyE6oqrPQ", name: "コムドット", keywords: "コムドット", group: "entertainment" },
  { slug: "nakata", id: "UCFo4kqllbcQ4nV83WCyraiw", name: "中田敦彦のYouTube大学", keywords: "中田敦彦", group: "learn" },
  { slug: "anija", id: "UC2GuoutVyegg6PUK88lLpjw", name: "兄者弟者（2BRO.）", keywords: "兄者弟者|2BRO", group: "game" },
  // 「ポッキー」だけではお菓子の話題も拾うため、会社名で見分ける
  { slug: "pds", id: "UCzWygEC8zQKYpCp7nwX_M-A", name: "PDS株式会社", keywords: "PDS株式会社", group: "game" },
  { slug: "ryuji", id: "UCW01sMEVYQdhcvkrhbxdBpw", name: "リュウジのバズレシピ", keywords: "料理研究家リュウジ|バズレシピ", group: "food" },
  { slug: "kohkentetsu", id: "UC3p5OTQsMEnmZktWUkw_Y0A", name: "コウケンテツ", keywords: "コウケンテツ", group: "food" },
  { slug: "pekora", id: "UC1DCedRgGHBdm81E1llLhOQ", name: "兎田ぺこら", keywords: "兎田ぺこら", group: "vtuber" },
  { slug: "marine", id: "UCCzUftO8KOVkV4wQG1vkUvg", name: "宝鐘マリン", keywords: "宝鐘マリン", group: "vtuber" },
  { slug: "sushiramen", id: "UCljYHFazflmGaDr5Lo90KmA", name: "すしらーめん《りく》", keywords: "すしらーめん", group: "entertainment" },
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

export const youtubeWatchUrl = (videoId: string, isShort = false) =>
  isShort ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
export const videoPath = (videoId: string) => `/youtube/v/${videoId}`;

/** 再生回数の表示（12.3万回、1,234回） */
export function viewsLabel(n: number): string {
  if (n >= 100_000_000) return `${Math.round(n / 10_000_000) / 10}億回`;
  if (n >= 10_000) return `${Math.round(n / 1000) / 10}万回`;
  return `${n.toLocaleString("ja-JP")}回`;
}
