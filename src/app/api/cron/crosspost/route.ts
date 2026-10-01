import { hasCronSecret } from "@/lib/auth";
import { runCrossPostCatchUp } from "@/lib/digest/crosspost";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

let running = false;

/** Bluesky への同時投稿の再試行と、Threads のトークンの延長（スケジューラーが定期的に呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) return Response.json({ status: "already-running" }, { status: 409 });
  running = true;
  try {
    return Response.json(await runCrossPostCatchUp());
  } finally {
    running = false;
  }
}
