import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { buildFollowupPrompt, buildStoryPrompt, FOLLOWUP_SYSTEM, STORY_SYSTEM } from "@/lib/stories/prompt";
import { FollowupAnalysisSchema, StoryAnalysisSchema } from "@/lib/stories/schema";
import { findDeltaQueued, findQueued, loadMaterials, loadPreviousCoverage } from "@/lib/stories/store";

export const dynamic = "force-dynamic";

/**
 * 解析待ちのストーリーと、その資料・指示・出力形式を返す。
 * API キーを使わずに外部（Claude Code の定期実行など）が解析するための窓口。
 * - stories: 通常の解析（StoryAnalysis）
 * - followups: 続報の差分の解析（FollowupAnalysis）
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(10, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 5));
  const [queued, deltas] = await Promise.all([findQueued(limit), findDeltaQueued(limit)]);
  const followups = await Promise.all(
    deltas.map(async (s) => {
      const previous = await loadPreviousCoverage(s.id);
      return previous ? { id: s.id, prompt: buildFollowupPrompt(previous, await loadMaterials(s.id)) } : null;
    }),
  );
  return Response.json({
    stories: {
      instructions: STORY_SYSTEM,
      outputSchema: z.toJSONSchema(StoryAnalysisSchema),
      submit: `POST ${siteConfig.url}/api/admin/stories/{id} に { "analysis": <outputSchema に従う JSON>, "model": "claude-code" } を送る`,
      items: await Promise.all(queued.map(async (s) => ({ id: s.id, prompt: buildStoryPrompt(await loadMaterials(s.id)) }))),
    },
    followups: {
      instructions: FOLLOWUP_SYSTEM,
      outputSchema: z.toJSONSchema(FollowupAnalysisSchema),
      submit: `POST ${siteConfig.url}/api/admin/stories/{id} に { "followup": <outputSchema に従う JSON>, "model": "claude-code" } を送る`,
      items: followups.filter((f) => f !== null),
    },
  });
}
