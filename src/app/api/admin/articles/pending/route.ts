import { z } from "zod";
import { siteConfig } from "@/config/site";
import { ArticleSchema, buildPrompt, SYSTEM } from "@/lib/ai/prompt";
import { countNewDueTopics, findDueTopics, findUpgradeTopics, loadTopicSources } from "@/lib/ai/store";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildRelatedPrompt, findRelatedEarlier } from "@/lib/ai/related";
import { compactPending } from "@/lib/admin/compact";

export const dynamic = "force-dynamic";

/**
 * まとめ記事を書くべきトピックと、その材料・執筆ルール・出力形式を返す。
 * API キーを使わずに外部の執筆者（Claude Code の定期実行など）が記事を書くための窓口。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // 1回に書く本数の上限。話題が多い時間帯でも書き漏らしが残らないよう、30本まで受け付ける
  const limit = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 5));
  // ?upgrade=1 は、今の形式になる前に書いた記事の書き直しだけを返す（臨時でまとめて書き直すとき）
  const upgrade = new URL(request.url).searchParams.get("upgrade") === "1";
  // ?ids=1,2 は、指定した話題を書き直す（大きな出来事を、そろった報道で厚く書き直すとき）
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && n < 2 ** 31)
    .slice(0, 10);
  const [topics, backlog] = await Promise.all([
    ids.length
      ? prisma.topic.findMany({ where: { id: { in: ids }, mergedIntoId: null }, select: { id: true, publisherCount: true, aiGeneratedAt: true } })
      : upgrade
        ? findUpgradeTopics(limit)
        : findDueTopics(limit),
    countNewDueTopics(),
  ]);

  const body = {
    instructions: SYSTEM,
    outputSchema: z.toJSONSchema(ArticleSchema),
    // まだまとめ記事のない、書くべきトピックの数（今回返した分を含む）
    backlog,
    submit: `POST ${siteConfig.url}/api/admin/articles/{id} に { "article": <outputSchema に従う JSON>, "sourceIds": <このトピックの sourceIds をそのまま> } を送る`,
    topics: await Promise.all(
      topics.map(async (t) => {
        const [sources, related] = await Promise.all([loadTopicSources(t.id), findRelatedEarlier(t.id)]);
        return {
          id: t.id,
          url: `${siteConfig.url}/topic/${t.id}`,
          publisherCount: t.publisherCount,
          regenerate: Boolean(t.aiGeneratedAt),
          sourceIds: sources.map((s) => s.id),
          // このサイトの過去のまとめ記事（「これまでの経緯」の材料）を資料のあとに添える
          prompt: buildPrompt(sources) + buildRelatedPrompt(related),
        };
      }),
    ),
  };
  return Response.json(compactPending(request, body));
}
