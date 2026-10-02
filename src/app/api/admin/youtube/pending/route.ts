import { z } from "zod";
import { siteConfig } from "@/config/site";
import { hasCronSecret } from "@/lib/auth";
import { buildVideoPrompt, findVideoSummaryCandidates, VIDEO_SUMMARY_SYSTEM, VideoSummarySchema } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/** 紹介文を書く候補の動画と、書き方のルール・出力形式を返す。記事作成の定期処理が使う */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Math.min(30, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 10));
  const videos = await findVideoSummaryCandidates(limit);
  return Response.json({
    instructions: VIDEO_SUMMARY_SYSTEM,
    outputSchema: z.toJSONSchema(VideoSummarySchema),
    submit: `POST ${siteConfig.url}/api/admin/youtube/{id} に { "result": <outputSchema に従う JSON> } を送る`,
    videos: videos.map((v) => ({ id: v.videoId, prompt: buildVideoPrompt(v) })),
  });
}
