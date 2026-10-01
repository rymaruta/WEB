import { z } from "zod";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FollowupAnalysisSchema, StoryAnalysisSchema } from "@/lib/stories/schema";
import { applyAnalysis, applyFollowup } from "@/lib/stories/store";

const BodySchema = z.union([
  z.object({ analysis: StoryAnalysisSchema, model: z.string().max(60).optional() }),
  z.object({ followup: FollowupAnalysisSchema, model: z.string().max(60).optional() }),
]);

/**
 * 外部で解析した結果を受け取り、照合して保存する。
 * 通常の解析（analysis）は QUEUED、続報の差分（followup）は DELTA_QUEUED のストーリーだけを受け付ける
 */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/stories/[id]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const story = await prisma.story.findUnique({ where: { id }, select: { status: true } });
  if (!story) return Response.json({ error: "story not found" }, { status: 404 });
  const model = parsed.data.model ?? "claude-code";

  if ("analysis" in parsed.data) {
    if (story.status !== "QUEUED") return Response.json({ error: `story is ${story.status}` }, { status: 409 });
    return Response.json(await applyAnalysis(id, parsed.data.analysis, "external", model));
  }
  if (story.status !== "DELTA_QUEUED") return Response.json({ error: `story is ${story.status}` }, { status: 409 });
  return Response.json(await applyFollowup(id, parsed.data.followup, "external", model));
}
