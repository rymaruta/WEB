import { z } from "zod";
import { siteConfig } from "@/config/site";
import { EXPLAINER_INSTRUCTIONS, ExplainerSchema } from "@/lib/ai/explainer";
import { EXPLAIN_MAX_PER_RUN, findExplainerTopics } from "@/lib/ai/explainer-store";
import { compactPending } from "@/lib/admin/compact";
import { hasCronSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 「◯◯とは」（編集部が調べた解説）を書くべき話題と、書き方・出力形式を返す。
 * 執筆者（Claude Code の定期実行）が公式サイトなどを自分で調べて書き、POST /api/admin/explainers/{id} に送る
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(EXPLAIN_MAX_PER_RUN, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || EXPLAIN_MAX_PER_RUN));
  const topics = await findExplainerTopics(limit);
  const body = {
    instructions: EXPLAINER_INSTRUCTIONS,
    outputSchema: z.toJSONSchema(z.object({ explainer: ExplainerSchema.nullable() })),
    submit: `POST ${siteConfig.url}/api/admin/explainers/{id} に { "explainer": <outputSchema の explainer>, "model": "claude-code" } を送る。書かないときは { "explainer": null, "reason": "<書かない理由を1文で>" }`,
    topics: topics.map((t) => {
      const points = Array.isArray(t.aiPoints) ? (t.aiPoints as { text?: string }[]).map((p) => p.text).filter(Boolean) : [];
      return {
        id: t.id,
        url: `${siteConfig.url}/topic/${t.id}`,
        prompt: [`ジャンル: ${t.genre.name}`, `見出し: ${t.aiTitle ?? t.title}`, `リード: ${t.aiLead ?? ""}`, ...points.map((p) => `・${p}`)].join("\n"),
      };
    }),
  };
  return Response.json(compactPending(request, body));
}
