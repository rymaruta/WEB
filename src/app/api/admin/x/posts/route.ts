import { z } from "zod";
import { activeTask, recordTaskOp, urlAllowed } from "@/lib/admin/task-ops";
import { hasCronSecret } from "@/lib/auth";
import { createPost, credentialsFromEnv } from "@/lib/x/client";

export const dynamic = "force-dynamic";

const Body = z.object({ taskId: z.string(), text: z.string().min(1).max(280), replyTo: z.string().regex(/^\d+$/).optional() });

/** 「AI に頼む」から X に投稿する（作業中の依頼にひも付けたときだけ） */
export async function POST(request: Request) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  const { taskId, text, replyTo } = parsed.data;
  const task = await activeTask(taskId);
  if (!task) return Response.json({ error: "作業中の依頼ではありません" }, { status: 403 });
  if (!urlAllowed(text, task.prompt)) return Response.json({ error: "URL 付きの投稿は料金が高いため、依頼文でリンク・URL を求めたときだけ投稿します" }, { status: 400 });
  const creds = credentialsFromEnv();
  if (!creds) return Response.json({ error: "X の認証情報がありません" }, { status: 500 });
  const id = await createPost(creds, text, [], replyTo);
  const url = `https://x.com/i/web/status/${id}`;
  await recordTaskOp(task.id, "X に投稿しました", `${text}\n${url}`);
  return Response.json({ id, url });
}
