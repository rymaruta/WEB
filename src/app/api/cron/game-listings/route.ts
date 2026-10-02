import { hasCronSecret } from "@/lib/auth";
import { syncGameListings } from "@/lib/game-listings";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 公式ストアの発売予定を取り込む（毎日決まった時刻にスケジューラーが呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await syncGameListings());
}
