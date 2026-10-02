import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 直近の、話題をまとめた記録（誤った統合の確認用）。?hours=48 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const hours = Math.min(24 * 30, Math.max(1, Number(new URL(request.url).searchParams.get("hours")) || 48));
  const merges = await prisma.topicMerge.findMany({
    where: { createdAt: { gte: new Date(Date.now() - hours * 3_600_000) } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const ids = [...new Set(merges.flatMap((m) => [m.keepId, m.dropId]))];
  const titles = new Map((await prisma.topic.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })).map((t) => [t.id, t.title]));
  return Response.json(
    merges.map((m) => ({ ...m, articles: m.articleIds.length, articleIds: undefined, keepTitle: titles.get(m.keepId), dropTitle: titles.get(m.dropId) })),
  );
}
