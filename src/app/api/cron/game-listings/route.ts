import { hasCronSecret } from "@/lib/auth";
import { syncGameListings } from "@/lib/game-listings";
import { logListings } from "@/lib/listings-log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** 公式ストアの発売予定を取り込む（毎日決まった時刻にスケジューラーが呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await syncGameListings();
  await logListings("listings.game", result);
  return Response.json(result);
}
