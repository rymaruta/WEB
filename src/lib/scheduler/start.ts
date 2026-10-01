import { msUntilJst } from "@/lib/digest/slots";
import { DAILY_JOBS, JOBS, resolveInterval, type Job } from "./jobs";

/** 起動直後はサーバーの準備が整うまで少し待ってから初回を実行する */
const FIRST_RUN_DELAY_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

let started = false;

/**
 * 自分自身を呼ぶときの宛先。サーバーは HOSTNAME で待ち受ける（Next.js standalone の仕様）。
 * 0.0.0.0（全アドレス）や未設定なら 127.0.0.1、それ以外（コンテナ名など）はその名前を使う
 */
export function selfHost(hostname: string | undefined): string {
  return !hostname || hostname === "0.0.0.0" || hostname === "::" ? "127.0.0.1" : hostname;
}

function log(level: "info" | "error", job: string, message: string, data?: unknown) {
  const line = JSON.stringify({ event: "scheduler", level, job, message, data, at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else console.log(line);
}

async function runJob(job: Pick<Job, "name" | "path">, secret: string, base: string, timeoutMs = REQUEST_TIMEOUT_MS) {
  try {
    const res = await fetch(`${base}${job.path}`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // 202 = 受付、409 = 前回が実行中（正常）
    if (res.status === 200 || res.status === 202 || res.status === 409) log("info", job.name, `HTTP ${res.status}`);
    else log("error", job.name, `HTTP ${res.status}`, await res.text().catch(() => ""));
  } catch (e) {
    const cause = e instanceof Error && e.cause ? ` (${String(e.cause)})` : "";
    log("error", job.name, "request failed", `${String(e)}${cause} url=${base}${job.path}`);
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
  const base = `http://${selfHost(process.env.HOSTNAME)}:${process.env.PORT ?? 3000}`;
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
  // 毎日決まった時刻の処理。DIGEST_ENABLED=false で止められる
  if (process.env.DIGEST_ENABLED === "false") {
    log("info", "digest", "disabled");
    return;
  }
  for (const job of DAILY_JOBS) {
    // 定時の自動投稿は AUTO_PUBLISH=false で止められる（下書き作りは続ける）
    if (job.publish && process.env.AUTO_PUBLISH === "false") {
      log("info", job.name, "disabled");
      continue;
    }
    const schedule = () => {
      const timer = setTimeout(() => {
        void runJob(job, secret, base, job.timeoutMs);
        schedule();
      }, msUntilJst(job.at, new Date()));
      timer.unref();
    };
    schedule();
    log("info", job.name, `daily at ${job.at} JST`);
  }
}
