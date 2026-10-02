import { revalidatePath } from "next/cache";
import { hasCronSecret } from "@/lib/auth";
import { undoMerge } from "@/lib/topics/genre-check";

export const dynamic = "force-dynamic";

/** 話題をまとめたのを取り消す（移した記事を元の話題へ戻す） */
export async function DELETE(request: Request, { params }: RouteContext<"/api/admin/merges/[id]">) {
  if (!hasCronSecret(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || id >= 2 ** 31) return Response.json({ error: "invalid id" }, { status: 400 });
  const r = await undoMerge(id);
  if (!r.ok) return Response.json(r, { status: r.error === "merge not found" ? 404 : 409 });
  revalidatePath("/");
  return Response.json(r);
}
