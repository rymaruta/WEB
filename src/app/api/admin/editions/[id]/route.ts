import { hasAdminAccess } from "@/lib/auth";
import { AdminError, cancelEdition } from "@/lib/digest/admin";

export const dynamic = "force-dynamic";

/** 下書きを取り消す（承認済み・投稿済みの回は取り消せない） */
export async function DELETE(request: Request, { params }: RouteContext<"/api/admin/editions/[id]">) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const e = await cancelEdition(id);
    return Response.json({ status: "canceled", key: e.key });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
