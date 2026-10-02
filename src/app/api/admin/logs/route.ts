import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 処理の記録（管理画面の「ログ」と同じ）。?scope=factcheck.names&hours=24&limit=200 で絞り込む。精度の測定に使う */
export async function GET(request: Request) {
  if (!hasCronSecret(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  const p = new URL(request.url).searchParams;
  const hours = Math.min(24 * 14, Math.max(1, Number(p.get("hours")) || 24));
  const limit = Math.min(1000, Math.max(1, Number(p.get("limit")) || 200));
  const scope = p.get("scope");
  const rows = await prisma.eventLog.findMany({
    where: {
      at: { gte: new Date(Date.now() - hours * 3_600_000) },
      ...(scope ? { scope: { startsWith: scope } } : {}),
    },
    orderBy: { at: "desc" },
    take: limit,
  });
  // id は BigInt のため、JSON にできる文字列にする
  return Response.json(rows.map((r) => ({ ...r, id: r.id.toString() })));
}
