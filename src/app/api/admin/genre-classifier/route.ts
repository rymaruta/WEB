import { hasAdminAccess } from "@/lib/auth";
import { evaluateGenreClassifier } from "@/lib/topics/genre-eval";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** ジャンルの自動判定の正答率を測る（読み取りのみ。分類は変えない）。?days=30&perSource=800 */
export async function GET(request: Request) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const days = Math.min(60, Math.max(1, Number(params.get("days")) || 30));
  const perSource = Math.min(3000, Math.max(50, Number(params.get("perSource")) || 800));
  return Response.json(await evaluateGenreClassifier({ days, perSource }));
}
