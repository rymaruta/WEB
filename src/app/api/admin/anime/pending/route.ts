import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { ANIME_EXTRACT_SYSTEM, AnimeExtractSchema, buildAnimePrompt, findAnimeCandidates } from "@/lib/anime";
import { compactPending } from "@/lib/admin/compact";

export const dynamic = "force-dynamic";

/** アニメの放送・配信スケジュールの候補の話題と、読み取りのルール・出力形式を返す。記事作成の定期処理が使う */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 20));
  const topics = await findAnimeCandidates(limit);
  const body = {
    instructions: ANIME_EXTRACT_SYSTEM,
    outputSchema: z.toJSONSchema(AnimeExtractSchema),
    submit: `POST ${siteConfig.url}/api/admin/anime/{id} に { "result": <outputSchema に従う JSON> } を送る`,
    topics: topics.map((t) => ({ id: t.id, prompt: buildAnimePrompt(t.articles) })),
  };
  return Response.json(compactPending(request, body));
}
