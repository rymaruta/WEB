import { after } from "next/server";
import { getStoryProvider, getStoryScope } from "@/lib/ai/provider";
import { autoBreakingWindow, BREAKING_RULES } from "@/lib/digest/breaking";
import { worthApi } from "@/lib/stories/hot";
import { prisma } from "@/lib/db";
import { hasCronSecret } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { applyAnalysis, applyFollowup, enqueueCandidates, findDeltaQueued, findHotQueued, findQueued, loadMaterials, loadPreviousCoverage } from "@/lib/stories/store";

export const maxDuration = 300;

/** 1回で登録する候補の最大数 */
const ENQUEUE_PER_RUN = 10;
/** サーバーで AI 解析する場合の1回の最大数（費用の上限管理） */
const ANALYZE_PER_RUN = Number(process.env.STORY_AI_MAX_PER_RUN ?? 5);
/** 速報の解析（大きな話題だけ）を API で行う1日の上限（費用の上限管理） */
const HOT_PER_DAY = Number(process.env.HOT_AI_MAX_PER_DAY ?? 10);

let running = false;

/**
 * ダイジェスト配信用のストーリーを作る定期処理。話題のトピックと、配信済みの出来事の続報を候補として登録し、
 * サーバーで AI を使う設定（STORY_AI_PROVIDER=claude）なら、応答後に解析まで行う。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (running) return Response.json({ status: "already-running" }, { status: 409 });
  running = true;
  let enqueued = { created: 0, followups: 0 };
  try {
    enqueued = await enqueueCandidates(ENQUEUE_PER_RUN);
  } catch (e) {
    running = false;
    await logEvent("error", "story.enqueue", "候補の登録に失敗", undefined, String(e));
    return Response.json({ error: "enqueue failed" }, { status: 500 });
  }
  const scope = getStoryScope();
  const provider = getStoryProvider(scope);
  if (!provider) {
    running = false;
    return Response.json({ status: "enqueued", enqueued, analyzer: "external" }, { status: 202 });
  }
  after(async () => {
    try {
      // 速報だけを解析する設定では、自動で投稿できる大きな話題（2媒体以上）だけを1日の上限まで解析する
      // （1媒体だけの話題・ほか・続報は、無料の外部の定期実行に任せる。API の費用を自動投稿に使う分だけにする）
      // 自動の速報を今日もう出せない（上限・停止中）ときは解析しない。深夜は災害だけ。事件・訃報・政治は自動では出さないので解析しない
      const hotUsed = scope === "hot" ? await prisma.eventLog.count({ where: { scope: "story.hot-ai", at: { gte: new Date(Date.now() - 24 * 3_600_000) } } }) : 0;
      const win = scope === "hot" ? await autoBreakingWindow() : { open: true, quiet: false };
      const room = win.open ? Math.min(ANALYZE_PER_RUN, Math.max(0, HOT_PER_DAY - hotUsed)) : 0;
      const queued =
        scope === "hot"
          ? await findHotQueued(room, BREAKING_RULES.hot.minPublishers, (title) => worthApi(title, { quiet: win.quiet }))
          : await findQueued(ANALYZE_PER_RUN);
      for (const s of queued) {
        if (scope === "hot") await logEvent("info", "story.hot-ai", "速報の候補を API で解析", s.id);
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
      for (const s of scope === "hot" ? [] : await findDeltaQueued(ANALYZE_PER_RUN)) {
        try {
          const previous = await loadPreviousCoverage(s.id);
          if (!previous) continue;
          const { analysis, model } = await provider.analyzeFollowup(previous, await loadMaterials(s.id));
          if (!analysis) {
            await logEvent("warn", "story.followup", "AI が結果を返さなかった（拒否・上限）", s.id, { model });
            continue;
          }
          await applyFollowup(s.id, analysis, provider.name, model);
        } catch (e) {
          await logEvent("error", "story.followup", "続報の解析に失敗", s.id, String(e));
        }
      }
    } finally {
      running = false;
    }
  });
  return Response.json({ status: "started", enqueued, analyzer: provider.name }, { status: 202 });
}
