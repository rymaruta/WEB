import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { findGenreCheckCandidates, GENRE_CHECK_LIMIT, GENRE_CHECK_SYSTEM, GenreCheckSchema } from "@/lib/topics/genre-check";

export const dynamic = "force-dynamic";

/** ジャンルを判定し直す話題と、判定のルール・出力形式を返す。記事作成の定期処理が使う */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(GENRE_CHECK_LIMIT, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || GENRE_CHECK_LIMIT));
  const topics = await findGenreCheckCandidates(limit);
  return Response.json({
    instructions: GENRE_CHECK_SYSTEM,
    outputSchema: z.toJSONSchema(GenreCheckSchema),
    submit: `POST ${siteConfig.url}/api/admin/genre-check に { "result": <outputSchema に従う JSON> } を送る（全件を1回で）`,
    topics,
  });
}
