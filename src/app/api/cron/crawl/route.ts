import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { hasCronSecret } from "@/lib/auth";
import { runCrawl } from "@/lib/crawl/run";

export const maxDuration = 300;

/** 同じサーバー内で収集が重ならないようにする */
let running = false;

/**
 * 定期収集のエンドポイント。外部スケジューラから `Authorization: Bearer $CRON_SECRET` 付きで呼び出す。
 * CRON_SECRET 未設定時は常に拒否する。
 * 収集には数分かかり、ホスティングの応答時間の上限（Lightsail は約60秒）を超えるため、
 * 受け付けた時点で 202 を返し、収集は応答後に after() で実行する。結果はサーバーのログに出力する。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) {
    return Response.json({ status: "already-running" }, { status: 409 });
  }
  running = true;
  after(async () => {
    try {
      const summary = await runCrawl();
      // 新しい記事がなければ作り直さない（5分ごとに回すため、ページの作り直しを減らす）
      if (summary.inserted > 0) revalidatePath("/", "layout");
      console.log(
        JSON.stringify({
          event: "crawl",
          inserted: summary.inserted,
          assigned: summary.assigned,
          topicsCreated: summary.topicsCreated,
          ai: summary.ai,
          errors: summary.sources.filter((s) => s.status === "error").map((s) => ({ name: s.name, error: s.error })),
          durationMs: summary.durationMs,
        }),
      );
    } catch (e) {
      console.error("crawl failed", e);
    } finally {
      running = false;
    }
  });
  return Response.json({ status: "started" }, { status: 202 });
}
