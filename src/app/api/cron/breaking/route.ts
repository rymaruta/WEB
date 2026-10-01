import { hasCronSecret } from "@/lib/auth";
import { runBreakingCheck } from "@/lib/digest/breaking";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

let running = false;

/** 速報の確認（スケジューラーが定期的に呼ぶ）。条件に合う出来事があれば1本だけ投稿する */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) return Response.json({ status: "already-running" }, { status: 409 });
  running = true;
  try {
    const result = await runBreakingCheck();
    return Response.json(result, { status: result.result === "failed" ? 500 : 200 });
  } finally {
    running = false;
  }
}
