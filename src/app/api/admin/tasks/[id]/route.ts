import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyOwner } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** 何でも頼める作業：定期実行が、頼まれた作業の中身を取りに来る（中身はサーバーに保存したものだけを渡す） */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/tasks/[id]">) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const task = await prisma.adminTask.findUnique({ where: { id: (await params).id }, select: { id: true, prompt: true, status: true, createdAt: true } });
  if (!task) return Response.json({ error: "task not found" }, { status: 404 });
  return Response.json(task);
}

const Body = z.object({ status: z.enum(["done", "failed"]), result: z.string().min(1).max(8000) });

/** 何でも頼める作業：定期実行が結果を返す。運営者にメールで知らせる */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/tasks/[id]">) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  const { id } = await params;
  const task = await prisma.adminTask.findUnique({ where: { id }, select: { status: true, prompt: true } });
  if (!task) return Response.json({ error: "task not found" }, { status: 404 });
  if (task.status !== "queued") return Response.json({ error: `task is ${task.status}` }, { status: 409 });
  await prisma.adminTask.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/tasks");
  await notifyOwner({
    title: parsed.data.status === "done" ? "AI に頼んだ作業が終わりました" : "AI に頼んだ作業ができませんでした",
    what: `頼んだこと：${task.prompt.slice(0, 120)}${task.prompt.length > 120 ? "…" : ""}`,
    detail: parsed.data.result.slice(0, 3000),
    url: "https://zenbu-navi.com/admin/tasks",
  });
  return Response.json({ status: "saved" });
}
