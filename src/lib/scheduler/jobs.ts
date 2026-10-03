import { ACTIVE_SLOTS, SLOTS } from "@/lib/digest/slots";

/** 定期処理の一覧。各ジョブは自分自身の API を Bearer 認証付きで呼び出す（ロックや再検証は API 側の実装を共有する） */
export type Job = {
  name: string;
  path: string;
  /** 実行間隔（分）。環境変数で上書きできる */
  intervalMinutes: number;
  envKey: string;
};

export const JOBS: Job[] = [
  // 収集は1回20〜30秒で終わるため、速報を早く拾えるよう5分ごとに回す（前の回が終わっていなければ飛ばす）
  { name: "crawl", path: "/api/cron/crawl", intervalMinutes: 5, envKey: "CRAWL_INTERVAL_MINUTES" },
  { name: "stories", path: "/api/cron/stories", intervalMinutes: 5, envKey: "STORIES_INTERVAL_MINUTES" },
  // 速報の確認。解析が終わった出来事を見て、条件に合えば投稿する。一斉に報じられた出来事の知らせも出す（src/lib/digest/breaking.ts）
  { name: "breaking", path: "/api/cron/breaking", intervalMinutes: 5, envKey: "BREAKING_INTERVAL_MINUTES" },
  // 日中の注目のニュースの自動投稿（1本ずつ。60分以上あけ、1日8本まで。src/lib/digest/pickup-auto.ts）
  { name: "pickup", path: "/api/cron/pickup", intervalMinutes: 10, envKey: "PICKUP_INTERVAL_MINUTES" },
  // Bluesky への同時投稿の再試行と、Threads のトークンの延長（src/lib/digest/crosspost.ts）。認証情報がなければ何もしない
  { name: "crosspost", path: "/api/cron/crosspost", intervalMinutes: 10, envKey: "CROSSPOST_INTERVAL_MINUTES" },
  // 仕事がたまった Claude Code の定期実行（まとめ記事・ダイジェスト用の解析）を起動する（src/lib/digest/dispatch.ts）
  { name: "routines", path: "/api/cron/routines", intervalMinutes: 5, envKey: "ROUTINES_INTERVAL_MINUTES" },
  // YouTube の新着動画と再生回数の取り込み（src/lib/youtube.ts）
  { name: "youtube", path: "/api/cron/youtube", intervalMinutes: 30, envKey: "YOUTUBE_INTERVAL_MINUTES" },
  // 話題の人物写真（Wikidata で人物と確かめた、Wikimedia Commons の自由利用ライセンスの写真。src/lib/photos.ts）
  { name: "photos", path: "/api/cron/photos", intervalMinutes: 5, envKey: "PHOTOS_INTERVAL_MINUTES" },
];

/** 環境変数の値（分）を読む。0 以下・数値でない場合は既定値。"off" ならジョブを止める */
export function resolveInterval(job: Job, env: Record<string, string | undefined>): number | null {
  const raw = env[job.envKey];
  if (raw === undefined || raw === "") return job.intervalMinutes;
  if (raw.toLowerCase() === "off") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : job.intervalMinutes;
}

/** 毎日決まった時刻（日本時間）に動かす処理。定時配信の下書き作りと投稿 */
export type DailyJob = {
  name: string;
  path: string;
  /** 日本時間 HH:MM */
  at: string;
  /** 待ち時間の上限（ミリ秒）。投稿は画像の作成とアップロードがあるため長めにする */
  timeoutMs?: number;
  /** 投稿のジョブ（AUTO_PUBLISH=false で止められる） */
  publish?: boolean;
};

const SLOT_KEYS = ACTIVE_SLOTS;

export const DAILY_JOBS: DailyJob[] = [
  ...SLOT_KEYS.map((slot) => ({
    name: `digest-${slot.toLowerCase()}`,
    path: `/api/cron/digest?slot=${slot}`,
    at: SLOTS[slot].buildAt,
  })),
  ...SLOT_KEYS.map((slot) => ({
    name: `publish-${slot.toLowerCase()}`,
    path: `/api/cron/publish?slot=${slot}`,
    at: SLOTS[slot].publishAt,
    timeoutMs: 180_000,
    publish: true,
  })),
  // 公式ストア（任天堂・PlayStation・Steam）の発売予定の取り込み（src/lib/game-listings.ts）
  { name: "game-listings", path: "/api/cron/game-listings", at: "05:10", timeoutMs: 300_000 },
  // 映画の公開予定の取り込み（src/lib/movie-listings.ts）
  { name: "movie-listings", path: "/api/cron/movie-listings", at: "05:20", timeoutMs: 120_000 },
  // テレビアニメの放送開始予定の取り込み（src/lib/anime-listings.ts）
  { name: "anime-listings", path: "/api/cron/anime-listings", at: "05:25", timeoutMs: 120_000 },
  // Threads への1日1本の投稿（src/lib/digest/threads-daily.ts）。認証情報がなければ何もしない
  // 時刻は THREADS_DAILY.at と合わせる（DB を使うモジュールをここで読み込まないため直接書く）
  { name: "threads-daily", path: "/api/cron/threads-daily?run=1", at: "21:00", timeoutMs: 180_000, publish: true },
];

/** 起動が投稿の時刻をまたいだときに、取りこぼした投稿を拾う猶予（分） */
export const CATCH_UP_MINUTES = 30;

/** 今が「投稿の時刻を過ぎて CATCH_UP_MINUTES 以内」の投稿ジョブ（再起動で予約が消えた回を拾うため） */
export function missedPublishJobs(now: Date, msSince: (at: string, now: Date) => number): DailyJob[] {
  return DAILY_JOBS.filter((j) => j.publish && msSince(j.at, now) >= 0 && msSince(j.at, now) <= CATCH_UP_MINUTES * 60_000);
}
