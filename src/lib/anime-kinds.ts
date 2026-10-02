/** 「放送・配信スケジュール」の種類（画面からも使うので DB に依存しない） */

export const ANIME_KINDS = ["tv", "stream", "movie", "other"] as const;
export type AnimeKind = (typeof ANIME_KINDS)[number];
export const ANIME_KIND_LABELS: Record<AnimeKind, string> = {
  tv: "放送",
  stream: "配信",
  movie: "劇場",
  other: "その他",
};

export type AnimeItem = { topicId: number; title: string; date: string; kind: AnimeKind; channel: string | null };
