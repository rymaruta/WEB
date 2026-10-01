/**
 * サーバー起動時に1回だけ呼ばれる。常駐サーバー（AWS Lightsail）では、定期処理のスケジューラーを起動する。
 * Vercel やビルド時には何もしない（SCHEDULER_ENABLED を設定した環境だけで動く）。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SCHEDULER_ENABLED !== "true") return;
  const { startScheduler } = await import("./lib/scheduler/start");
  startScheduler();
}
