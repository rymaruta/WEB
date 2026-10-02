import { hasCronSecret } from "@/lib/auth";
import { syncMovieListings } from "@/lib/movie-listings";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 映画の公開予定を取り込む（毎日決まった時刻にスケジューラーが呼ぶ） */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await syncMovieListings());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
