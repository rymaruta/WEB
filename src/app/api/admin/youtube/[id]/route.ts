import { hasCronSecret } from "@/lib/auth";
import { saveVideoSummary, VideoSummarySchema } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/** 動画の紹介文を受け取り、題名・説明文と照合して保存する */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/youtube/[id]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = (await params).id;
  if (!/^[\w-]{11}$/.test(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { result?: unknown } | null;
  const parsed = VideoSummarySchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "invalid result", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  try {
    const { saved } = await saveVideoSummary(id, parsed.data);
    return Response.json({ status: saved ? "saved" : "checked", summary: saved });
  } catch {
    return Response.json({ error: "video not found" }, { status: 404 });
  }
}
