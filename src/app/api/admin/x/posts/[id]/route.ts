import { activeTask, recordTaskOp } from "@/lib/admin/task-ops";
import { hasCronSecret } from "@/lib/auth";
import { credentialsFromEnv, deletePost } from "@/lib/x/client";

export const dynamic = "force-dynamic";

/** 「AI に頼む」から X の投稿を削除する（作業中の依頼にひも付けたときだけ。?taskId=…） */
export async function DELETE(request: Request, { params }: RouteContext<"/api/admin/x/posts/[id]">) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "invalid post id" }, { status: 400 });
  const task = await activeTask(new URL(request.url).searchParams.get("taskId"));
  if (!task) return Response.json({ error: "作業中の依頼ではありません" }, { status: 403 });
  const creds = credentialsFromEnv();
  if (!creds) return Response.json({ error: "X の認証情報がありません" }, { status: 500 });
  await deletePost(creds, id);
  await recordTaskOp(task.id, "X の投稿を削除しました", `https://x.com/i/web/status/${id}`);
  return Response.json({ deleted: id });
}
