import { hasCronSecret } from "@/lib/auth";
import { AnimeExtractSchema, saveAnimeExtract } from "@/lib/anime";

export const dynamic = "force-dynamic";

/** アニメの放送・配信の読み取り結果を受け取り、資料と照合して保存する */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/anime/[id]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { result?: unknown } | null;
  const parsed = AnimeExtractSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "invalid result", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  try {
    const { saved } = await saveAnimeExtract(id, parsed.data);
    return Response.json({ status: saved ? "saved" : "checked", anime: saved });
  } catch {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }
}
