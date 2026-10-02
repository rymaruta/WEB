import { hasAdminAccess } from "@/lib/auth";
import { applyTopicGenreRules } from "@/lib/topics/genre-apply";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const params = (request: Request) => {
  const p = new URL(request.url).searchParams;
  return {
    hours: Math.min(24 * 14, Math.max(1, Number(p.get("hours")) || 48)),
    limit: Math.min(10_000, Math.max(1, Number(p.get("limit")) || 3000)),
    revote: p.get("revote") === "1",
  };
};

/** 話題のジャンルをルールで見直した場合に、変わる件数と例を返す（読み取りのみ）。?hours=48&limit=3000 */
export async function GET(request: Request) {
  if (!(await hasAdminAccess(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { hours, limit } = params(request);
  return Response.json(await applyTopicGenreRules(hours, true, limit));
}

/** 話題のジャンルをルールで見直し、判定の記録（genreNote）を残す。記事・話題は消さない。?revote=1 で先に多数決から数え直す */
export async function POST(request: Request) {
  if (!(await hasAdminAccess(request))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { hours, limit, revote } = params(request);
  return Response.json(await applyTopicGenreRules(hours, false, limit, { revote }));
}
