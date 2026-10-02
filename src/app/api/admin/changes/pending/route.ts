import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { buildChangePrompt, findChangeCandidates, CHANGE_EXTRACT_SYSTEM, ChangeExtractSchema } from "@/lib/changes";

export const dynamic = "force-dynamic";

/** 「◯月から変わること」の候補の話題と、読み取りのルール・出力形式を返す。記事作成の定期処理が使う */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 20));
  const topics = await findChangeCandidates(limit);
  return Response.json({
    instructions: CHANGE_EXTRACT_SYSTEM,
    outputSchema: z.toJSONSchema(ChangeExtractSchema),
    submit: `POST ${siteConfig.url}/api/admin/changes/{id} に { "result": <outputSchema に従う JSON> } を送る`,
    topics: topics.map((t) => ({ id: t.id, prompt: buildChangePrompt(t.articles) })),
  });
}
