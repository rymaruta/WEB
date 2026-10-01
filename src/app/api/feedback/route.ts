import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

/**
 * まとめ記事の「役に立った／分かりにくい」。記事ごとの件数だけを増やし、誰が押したかは保存しない。
 * 同じ人の重複はブラウザー側で防ぐ（src/components/feedback-buttons.tsx）
 */
export async function POST(request: Request) {
  if (BOT.test(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as { topicId?: unknown; kind?: unknown } | null;
  const topicId = Number(body?.topicId);
  const kind = body?.kind === "helpful" || body?.kind === "unclear" ? body.kind : null;
  if (!kind || !Number.isInteger(topicId) || topicId <= 0 || topicId >= 2 ** 31) return new Response(null, { status: 400 });
  const exists = await prisma.topic.count({ where: { id: topicId, aiGeneratedAt: { not: null } } }).catch(() => 0);
  if (!exists) return new Response(null, { status: 404 });
  await prisma.topicFeedback
    .upsert({
      where: { topicId },
      create: { topicId, helpful: kind === "helpful" ? 1 : 0, unclear: kind === "unclear" ? 1 : 0 },
      update: { [kind]: { increment: 1 } },
    })
    .catch(() => null);
  return new Response(null, { status: 204 });
}
