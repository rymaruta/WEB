import { hasCronSecret } from "@/lib/auth";
import { GenreCheckSchema, saveGenreChecks } from "@/lib/topics/genre-check";

export const dynamic = "force-dynamic";

/** ジャンルの判定結果をまとめて受け取り、保存する */
export async function POST(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { result?: unknown } | null;
  const parsed = GenreCheckSchema.safeParse(body?.result);
  if (!parsed.success) return Response.json({ error: "invalid result", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  return Response.json(await saveGenreChecks(parsed.data.results));
}
