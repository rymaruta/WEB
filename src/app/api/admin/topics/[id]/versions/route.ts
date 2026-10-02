import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** AI まとめ記事の版の一覧（新しい順）。誤りの調査や、更新前の内容の確認に使う */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/topics/[id]/versions">) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) return Response.json({ error: "invalid topic id" }, { status: 400 });
  return Response.json(await prisma.topicArticleVersion.findMany({ where: { topicId: id }, orderBy: { createdAt: "desc" }, take: 20 }));
}
