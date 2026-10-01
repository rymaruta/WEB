import { z } from "zod";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { StoryAnalysisSchema } from "@/lib/stories/schema";
import { applyAnalysis } from "@/lib/stories/store";

const BodySchema = z.object({
  analysis: StoryAnalysisSchema,
  /** 解析した AI の記録用（例: "claude-code"） */
  model: z.string().max(60).optional(),
});

/** 外部で解析した結果を受け取り、照合して保存する。解析待ち（QUEUED）のストーリーだけを受け付ける */
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
  if (story.status !== "QUEUED") return Response.json({ error: `story is ${story.status}` }, { status: 409 });

  const { status, notes } = await applyAnalysis(id, parsed.data.analysis, "external", parsed.data.model ?? "claude-code");
  return Response.json({ status, notes });
}
