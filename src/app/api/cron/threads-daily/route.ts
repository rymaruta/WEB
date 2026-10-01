import { hasCronSecret } from "@/lib/auth";
import { runThreadsDaily } from "@/lib/digest/threads-daily";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

let running = false;

/** Threads への1日1本の投稿（毎日決まった時刻にスケジューラーが呼ぶ）。今日の分を投稿済みなら何もしない */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) return Response.json({ status: "already-running" }, { status: 409 });
  running = true;
  try {
    const result = await runThreadsDaily();
    return Response.json(result, { status: result.result === "failed" ? 500 : 200 });
  } finally {
    running = false;
  }
}
