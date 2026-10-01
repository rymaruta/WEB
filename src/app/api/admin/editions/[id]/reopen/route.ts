import { hasAdminAccess } from "@/lib/auth";
import { AdminError, reopenForRepost } from "@/lib/digest/admin";

export const dynamic = "force-dynamic";

/** 投稿済みの回を、出し直せる下書きに戻す（X の投稿は運営者が削除する） */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/editions/[id]/reopen">) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await reopenForRepost((await params).id);
    return Response.json({ status: "reopened" });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
