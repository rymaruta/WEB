import { hasAdminAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** まとめ記事への読者の評価（「分かりにくい」が多い順）。管理画面と同じ内容を、定期処理や調査から読めるようにする。?days=7 */
export async function GET(request: Request) {
  if (!(await hasAdminAccess(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 7));
  const feedback = await prisma.topicFeedback.findMany({
    where: { updatedAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: [{ unclear: "desc" }, { helpful: "desc" }],
    take: 100,
  });
  const topics = await prisma.topic.findMany({
    where: { id: { in: feedback.map((f) => f.topicId) } },
    select: { id: true, title: true, aiTitle: true, aiLead: true, aiGeneratedAt: true },
  });
  const byId = new Map(topics.map((t) => [t.id, t]));
  return Response.json({
    days,
    items: feedback.map((f) => ({ ...f, topic: byId.get(f.topicId) ?? null })),
  });
}
