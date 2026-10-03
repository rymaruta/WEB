import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const reasonKey = (r: string) => r.replace(/[:：（(].*$/, "");

/** 要確認（REVIEW_REQUIRED）になった出来事と理由の一覧（点検用）。?hours=24 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const hours = Math.min(168, Math.max(1, Number(new URL(request.url).searchParams.get("hours")) || 24));
  const stories = await prisma.story.findMany({
    where: { status: "REVIEW_REQUIRED", createdAt: { gte: new Date(Date.now() - hours * 3_600_000) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, kind: true, category: true, headline: true, riskFlags: true, confidence: true, statusNote: true, topic: { select: { id: true, publisherCount: true } } },
  });
  const reasons: Record<string, number> = {};
  for (const s of stories) for (const r of (s.statusNote ?? "").split("\n").filter(Boolean)) reasons[reasonKey(r)] = (reasons[reasonKey(r)] ?? 0) + 1;
  return Response.json({ count: stories.length, reasons, stories });
}
