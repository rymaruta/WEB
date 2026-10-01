import { SLOTS } from "@/lib/digest/slots";

/** 定期処理の一覧。各ジョブは自分自身の API を Bearer 認証付きで呼び出す（ロックや再検証は API 側の実装を共有する） */
export type Job = {
  name: string;
  path: string;
  /** 実行間隔（分）。環境変数で上書きできる */
  intervalMinutes: number;
  envKey: string;
};

export const JOBS: Job[] = [
  { name: "crawl", path: "/api/cron/crawl", intervalMinutes: 15, envKey: "CRAWL_INTERVAL_MINUTES" },
  { name: "stories", path: "/api/cron/stories", intervalMinutes: 15, envKey: "STORIES_INTERVAL_MINUTES" },
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

const SLOT_KEYS = ["MORNING", "LUNCH", "EVENING"] as const;

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
];

/** 起動が投稿の時刻をまたいだときに、取りこぼした投稿を拾う猶予（分） */
export const CATCH_UP_MINUTES = 30;

/** 今が「投稿の時刻を過ぎて CATCH_UP_MINUTES 以内」の投稿ジョブ（再起動で予約が消えた回を拾うため） */
export function missedPublishJobs(now: Date, msSince: (at: string, now: Date) => number): DailyJob[] {
  return DAILY_JOBS.filter((j) => j.publish && msSince(j.at, now) >= 0 && msSince(j.at, now) <= CATCH_UP_MINUTES * 60_000);
}
