import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ArticleSchema, sanitizeArticle } from "@/lib/ai/prompt";
import { loadTopicSources, markAttempted, saveArticle } from "@/lib/ai/store";
import { hasCronSecret } from "@/lib/auth";

const BodySchema = z.object({
  article: ArticleSchema,
  sourceIds: z.array(z.number().int()).min(1).max(12),
  /** 執筆者の記録用（例: "claude-code"） */
  model: z.string().max(60).optional(),
});

/** 外部の執筆者が書いたまとめ記事を検証して保存する */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/articles/[id]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const topicId = Number((await params).id);
  if (!Number.isInteger(topicId) || topicId <= 0 || topicId >= 2 ** 31) {
    return Response.json({ error: "invalid topic id" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const { article, sourceIds, model } = parsed.data;

  // 出典はこのトピックに属する記事に限る（取得後に記事が増えても、執筆時の対応表をそのまま使う）
  const belonging = new Set((await loadTopicSources(topicId)).map((s) => s.id));
  if (belonging.size === 0) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }
  if (!sourceIds.every((id) => belonging.has(id))) {
    return Response.json({ error: "sourceIds must be articles of this topic" }, { status: 400 });
  }

  const clean = sanitizeArticle(article, sourceIds.length);
  if (!clean) {
    await markAttempted(topicId);
    return Response.json({ status: "skipped" });
  }
  await saveArticle(topicId, clean, sourceIds, model ?? "claude-code");
  revalidatePath(`/topic/${topicId}`);
  revalidatePath("/articles");
  revalidatePath("/");
  return Response.json({ status: "saved", url: `/topic/${topicId}` });
}
