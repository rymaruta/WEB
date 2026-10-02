import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";

/**
 * 「AI に頼む」から行う外への操作（X への投稿・削除）。運営者が頼んだ作業（作業中の AdminTask）にひも付けたときだけ許す。
 * 行った操作はすべて記録し、運営者にメールで知らせる
 */

/** 作業中の依頼か。依頼文を返す（作業中でなければ null） */
export async function activeTask(taskId: unknown): Promise<{ id: string; prompt: string } | null> {
  if (typeof taskId !== "string" || !/^[a-z0-9]{10,40}$/.test(taskId)) return null;
  const task = await prisma.adminTask.findUnique({ where: { id: taskId }, select: { id: true, prompt: true, status: true, createdAt: true } });
  // 作業中で、頼んでから2時間以内のものだけ
  if (!task || task.status !== "queued" || Date.now() - task.createdAt.getTime() > 2 * 3_600_000) return null;
  return task;
}

/** URL の入った投稿は料金が高い（1件 $0.20）ため、依頼文でリンク・URL を求めたときだけ許す */
export function urlAllowed(text: string, prompt: string): boolean {
  if (!/https?:\/\/|[a-z0-9-]+\.(com|jp|net|org)\b/i.test(text)) return true;
  return /リンク|URL|url/.test(prompt);
}

export async function recordTaskOp(taskId: string, what: string, detail: string) {
  await logEvent("info", "task.x", what, taskId, { detail });
  await notifyOwner({ title: `AI に頼んだ作業で ${what}`, what: detail, url: "https://zenbu-navi.com/admin/tasks" });
}
