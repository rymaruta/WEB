import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { buildGamePrompt, findGameCandidates, GAME_EXTRACT_SYSTEM, GameExtractSchema } from "@/lib/game-extract";
import { compactPending } from "@/lib/admin/compact";

export const dynamic = "force-dynamic";

/** ゲームの発売日を読み取るべき話題（候補）と、読み取りのルール・出力形式を返す。記事作成の定期処理が使う */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 20));
  const topics = await findGameCandidates(limit);
  const body = {
    instructions: GAME_EXTRACT_SYSTEM,
    outputSchema: z.toJSONSchema(GameExtractSchema),
    submit: `POST ${siteConfig.url}/api/admin/games/{id} に { "result": <outputSchema に従う JSON> } を送る`,
    topics: topics.map((t) => ({ id: t.id, prompt: buildGamePrompt(t.articles) })),
  };
  return Response.json(compactPending(request, body));
}
