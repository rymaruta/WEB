/** 「放送・配信スケジュール」の種類（画面からも使うので DB に依存しない） */

export const ANIME_KINDS = ["tv", "stream", "movie", "other"] as const;
export type AnimeKind = (typeof ANIME_KINDS)[number];
export const ANIME_KIND_LABELS: Record<AnimeKind, string> = {
  tv: "放送",
  stream: "配信",
  movie: "劇場",
  other: "その他",
};

/** topicId がなければ、放送開始予定の一覧（Wikipedia）だけに載っている作品 */
export type AnimeItem = { topicId: number | null; title: string; date: string; kind: AnimeKind; channel: string | null };
