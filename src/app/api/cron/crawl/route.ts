import { revalidatePath } from "next/cache";
import { hasCronSecret } from "@/lib/auth";
import { runCrawl } from "@/lib/crawl/run";

export const maxDuration = 300;

/**
 * 定期収集のエンドポイント。Vercel Cron や外部スケジューラから
 * `Authorization: Bearer $CRON_SECRET` 付きで呼び出す。CRON_SECRET 未設定時は常に拒否する。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runCrawl();
  revalidatePath("/", "layout");
  return Response.json({
    inserted: summary.inserted,
    assigned: summary.assigned,
    topicsCreated: summary.topicsCreated,
    ai: summary.ai,
    errors: summary.sources.filter((s) => s.status === "error").map((s) => ({ name: s.name, error: s.error })),
    durationMs: summary.durationMs,
  });
}
