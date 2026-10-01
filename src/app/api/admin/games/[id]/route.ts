import { hasCronSecret } from "@/lib/auth";
import { GameExtractSchema, saveGameExtract } from "@/lib/game-extract";

export const dynamic = "force-dynamic";

/** ゲームの発売日の読み取り結果を受け取り、資料と照合して保存する */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/games/[id]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { result?: unknown } | null;
  const parsed = GameExtractSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "invalid result", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  try {
    const { saved } = await saveGameExtract(id, parsed.data);
    return Response.json({ status: saved ? "saved" : "checked", game: saved });
  } catch {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }
}
