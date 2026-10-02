import { hasCronSecret } from "@/lib/auth";
import { syncYouTube } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** YouTube の新着動画と再生回数を取り込む（スケジューラーが30分ごとに呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await syncYouTube());
}
