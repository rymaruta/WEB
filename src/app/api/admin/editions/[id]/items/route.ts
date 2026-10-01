import { hasAdminAccess } from "@/lib/auth";
import { addTopicToEdition, AdminError } from "@/lib/digest/admin";

export const dynamic = "force-dynamic";

/** 下書きに話題を足す。{ "topicId": 123, "confirm": true } */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/editions/[id]/items">) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { topicId?: unknown; confirm?: unknown } | null;
  const topicId = Number(body?.topicId);
  if (!Number.isInteger(topicId)) return Response.json({ error: "topicId is required" }, { status: 400 });
  try {
    const storyId = await addTopicToEdition((await params).id, topicId, body?.confirm === true);
    return Response.json({ status: "added", storyId });
  } catch (e) {
    if (e instanceof AdminError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
