import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { buildStoryPrompt, STORY_SYSTEM } from "@/lib/stories/prompt";
import { StoryAnalysisSchema } from "@/lib/stories/schema";
import { findQueued, loadMaterials } from "@/lib/stories/store";

export const dynamic = "force-dynamic";

/**
 * 解析待ちのストーリーと、その資料・指示・出力形式を返す。
 * API キーを使わずに外部（Claude Code の定期実行など）が解析するための窓口。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(10, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 5));
  const queued = await findQueued(limit);
  return Response.json({
    instructions: STORY_SYSTEM,
    outputSchema: z.toJSONSchema(StoryAnalysisSchema),
    submit: `POST ${siteConfig.url}/api/admin/stories/{id} に { "analysis": <outputSchema に従う JSON>, "model": "claude-code" } を送る`,
    stories: await Promise.all(queued.map(async (s) => ({ id: s.id, prompt: buildStoryPrompt(await loadMaterials(s.id)) }))),
  });
}
