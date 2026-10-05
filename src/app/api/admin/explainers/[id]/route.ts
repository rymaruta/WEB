import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkExplainer, ExplainerSchema, fetchPageText } from "@/lib/ai/explainer";
import { saveExplainer } from "@/lib/ai/explainer-store";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";

export const maxDuration = 60;

const BodySchema = z.object({
  explainer: ExplainerSchema.nullable(),
  /** 執筆者の記録用（例: "claude-code"） */
  model: z.string().max(60).optional(),
});

/**
 * 執筆者が調べて書いた「◯◯とは」を検証して保存する。
 * 出典のページをこのサイトが自分で取得し、抜き書きがページにあるか・文の語が抜き書きにあるかを確かめる（src/lib/ai/explainer.ts）
 */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/explainers/[id]">) {
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
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true, aiGeneratedAt: true, aiTitle: true, aiLead: true, aiPoints: true } });
  if (!topic?.aiGeneratedAt) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const { explainer } = parsed.data;
  if (!explainer) {
    await saveExplainer(topicId, null);
    return Response.json({ status: "skipped", reason: "not written" });
  }
  // 同じページを何度も取りに行かない
  const cache = new Map<string, Promise<string | null>>();
  const pages = await Promise.all(
    explainer.refs.map((r) => {
      if (!cache.has(r.url)) cache.set(r.url, fetchPageText(r.url));
      return cache.get(r.url)!;
    }),
  );
  // 記事の見出し・リード・要点（報道との照合を通ったもの）にある語は、抜き書きになくてよい
  const points = Array.isArray(topic.aiPoints) ? (topic.aiPoints as { text?: string }[]).map((p) => p.text ?? "") : [];
  const checked = checkExplainer(explainer, pages, [topic.aiTitle ?? "", topic.aiLead ?? "", ...points].join("\n"));
  await saveExplainer(topicId, checked.explainer);
  if (checked.problems.length) {
    await logEvent("info", "explainer.check", `topic ${topicId}: ${checked.problems.join(" / ").slice(0, 900)}（${checked.explainer ? "掲載" : "不採用"}）`);
  }
  if (!checked.explainer) {
    return Response.json({ status: "skipped", problems: checked.problems });
  }
  revalidatePath(`/topic/${topicId}`);
  return Response.json({ status: "saved", items: checked.explainer.items.length, problems: checked.problems, url: `/topic/${topicId}` });
}
