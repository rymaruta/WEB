import { hasCronSecret } from "@/lib/auth";
import { logListings } from "@/lib/listings-log";
import { syncAnimeListings } from "@/lib/anime-listings";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** テレビアニメの放送開始予定を取り込む（毎日決まった時刻にスケジューラーが呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncAnimeListings();
    await logListings("listings.anime", result);
    return Response.json(result);
  } catch (e) {
    await logListings("listings.anime", null, e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
