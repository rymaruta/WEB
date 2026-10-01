import { JOBS, resolveInterval, type Job } from "./jobs";

/** 起動直後はサーバーの準備が整うまで少し待ってから初回を実行する */
const FIRST_RUN_DELAY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

let started = false;

function log(level: "info" | "error", job: string, message: string, data?: unknown) {
  const line = JSON.stringify({ event: "scheduler", level, job, message, data, at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else console.log(line);
}

async function runJob(job: Job, secret: string, base: string) {
  try {
    const res = await fetch(`${base}${job.path}`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    // 202 = 受付、409 = 前回が実行中（正常）
    if (res.status === 200 || res.status === 202 || res.status === 409) log("info", job.name, `HTTP ${res.status}`);
    else log("error", job.name, `HTTP ${res.status}`, await res.text().catch(() => ""));
  } catch (e) {
    log("error", job.name, "request failed", String(e));
  }
}

/** 常駐サーバーで定期処理を動かす。二重起動しない */
export function startScheduler() {
  if (started) return;
  started = true;
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log("error", "*", "CRON_SECRET が未設定のため、スケジューラーを起動しません");
    return;
  }
  const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  for (const job of JOBS) {
    const minutes = resolveInterval(job, process.env);
    if (minutes === null) {
      log("info", job.name, "disabled");
      continue;
    }
    const first = setTimeout(() => {
      void runJob(job, secret, base);
      setInterval(() => void runJob(job, secret, base), minutes * 60_000).unref();
    }, FIRST_RUN_DELAY_MS);
    first.unref();
    log("info", job.name, `every ${minutes} min`);
  }
}
