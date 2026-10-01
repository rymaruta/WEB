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
];

/** 環境変数の値（分）を読む。0 以下・数値でない場合は既定値。"off" ならジョブを止める */
export function resolveInterval(job: Job, env: Record<string, string | undefined>): number | null {
  const raw = env[job.envKey];
  if (raw === undefined || raw === "") return job.intervalMinutes;
  if (raw.toLowerCase() === "off") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : job.intervalMinutes;
}
