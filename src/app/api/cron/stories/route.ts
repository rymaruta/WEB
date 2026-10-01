import { after } from "next/server";
import { getStoryProvider } from "@/lib/ai/provider";
import { hasCronSecret } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { applyAnalysis, enqueueCandidates, findQueued, loadMaterials } from "@/lib/stories/store";

export const maxDuration = 300;

/** 1回で登録する候補の最大数 */
const ENQUEUE_PER_RUN = 10;
/** サーバーで AI 解析する場合の1回の最大数（費用の上限管理） */
const ANALYZE_PER_RUN = Number(process.env.STORY_AI_MAX_PER_RUN ?? 5);

let running = false;

/**
 * X 配信用のストーリーを作る定期処理。話題のトピックを候補として登録し、
 * サーバーで AI を使う設定（STORY_AI_PROVIDER=claude）なら、応答後に解析まで行う。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) return Response.json({ status: "already-running" }, { status: 409 });
  running = true;
  let enqueued = 0;
  try {
    enqueued = await enqueueCandidates(ENQUEUE_PER_RUN);
  } catch (e) {
    running = false;
    await logEvent("error", "story.enqueue", "候補の登録に失敗", undefined, String(e));
    return Response.json({ error: "enqueue failed" }, { status: 500 });
  }
  const provider = getStoryProvider();
  if (!provider) {
    running = false;
    return Response.json({ status: "enqueued", enqueued, analyzer: "external" }, { status: 202 });
  }
  after(async () => {
    try {
      for (const s of await findQueued(ANALYZE_PER_RUN)) {
        try {
          const { analysis, model } = await provider.analyzeStory(await loadMaterials(s.id));
          if (!analysis) {
            await logEvent("warn", "story.analyze", "AI が結果を返さなかった（拒否・上限）", s.id, { model });
            continue;
          }
          await applyAnalysis(s.id, analysis, provider.name, model);
        } catch (e) {
          await logEvent("error", "story.analyze", "AI 解析に失敗", s.id, String(e));
        }
      }
    } finally {
      running = false;
    }
  });
  return Response.json({ status: "started", enqueued, analyzer: provider.name }, { status: 202 });
}
