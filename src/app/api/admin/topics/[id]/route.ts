import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasCronSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mergeTopics } from "@/lib/topics/genre-check";

export const dynamic = "force-dynamic";

const Body = z.object({
  /** トップの一番上に固定する時間（時間）。0 で固定をやめる */
  pinHours: z.number().min(0).max(72).optional(),
  /** 同じ出来事の別の話題（この話題にまとめる） */
  merge: z.array(z.number().int().positive()).max(10).optional(),
});

/** 大きな出来事を運営者が目立たせる：同じ出来事の話題をまとめ、トップの一番上に固定する */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/topics/[id]">) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) return Response.json({ error: "invalid topic id" }, { status: 400 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  const { pinHours, merge } = parsed.data;

  const merged = merge?.length ? await mergeTopics(merge.map((m) => [id, m] as const), new Date(), { source: "admin" }) : 0;
  // まとめた結果、残った側（まとめ記事のあるほう・媒体の多いほう）を固定する
  const topic = await prisma.topic.findUnique({ where: { id }, select: { id: true, mergedIntoId: true } });
  if (!topic) return Response.json({ error: "topic not found" }, { status: 404 });
  const target = topic.mergedIntoId ?? topic.id;
  if (pinHours !== undefined) {
    await prisma.topic.update({ where: { id: target }, data: { pinnedUntil: pinHours > 0 ? new Date(Date.now() + pinHours * 3_600_000) : null } });
  }
  revalidatePath("/");
  revalidatePath(`/topic/${target}`);
  const after = await prisma.topic.findUnique({ where: { id: target }, select: { id: true, publisherCount: true, pinnedUntil: true } });
  return Response.json({ merged, topic: after });
}
