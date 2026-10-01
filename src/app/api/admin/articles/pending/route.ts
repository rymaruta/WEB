import { z } from "zod";
import { siteConfig } from "@/config/site";
import { ArticleSchema, buildPrompt, SYSTEM } from "@/lib/ai/prompt";
import { findDueTopics, findUpgradeTopics, loadTopicSources } from "@/lib/ai/store";
import { hasCronSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * まとめ記事を書くべきトピックと、その材料・執筆ルール・出力形式を返す。
 * API キーを使わずに外部の執筆者（Claude Code の定期実行など）が記事を書くための窓口。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(10, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 5));
  // ?upgrade=1 は、今の形式になる前に書いた記事の書き直しだけを返す（臨時でまとめて書き直すとき）
  const upgrade = new URL(request.url).searchParams.get("upgrade") === "1";
  const topics = upgrade ? await findUpgradeTopics(limit) : await findDueTopics(limit);

  return Response.json({
    instructions: SYSTEM,
    outputSchema: z.toJSONSchema(ArticleSchema),
    submit: `POST ${siteConfig.url}/api/admin/articles/{id} に { "article": <outputSchema に従う JSON>, "sourceIds": <このトピックの sourceIds をそのまま> } を送る`,
    topics: await Promise.all(
      topics.map(async (t) => {
        const sources = await loadTopicSources(t.id);
        return {
          id: t.id,
          url: `${siteConfig.url}/topic/${t.id}`,
          publisherCount: t.publisherCount,
          regenerate: Boolean(t.aiGeneratedAt),
          sourceIds: sources.map((s) => s.id),
          prompt: buildPrompt(sources),
        };
      }),
    ),
  });
}
