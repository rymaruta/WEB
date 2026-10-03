import { hasCronSecret } from "@/lib/auth";
import { runAutoPickup } from "@/lib/digest/pickup-auto";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

let running = false;

/** 日中の注目のニュースの自動投稿（スケジューラーが定期的に呼ぶ）。条件に合えば1本だけ投稿する */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) return Response.json({ status: "already-running" }, { status: 409 });
  running = true;
  try {
    const result = await runAutoPickup();
    return Response.json(result, { status: result.result === "failed" ? 500 : 200 });
  } finally {
    running = false;
  }
}
