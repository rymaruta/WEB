import { hasAdminAccess } from "@/lib/auth";
import { loadEntries } from "@/lib/digest/build";
import { renderCard } from "@/lib/digest/cards";
import { draftHeadline } from "@/lib/digest/breaking";
import { buildBreakingCard } from "@/lib/digest/compose";
import { prisma } from "@/lib/db";


export const dynamic = "force-dynamic";

/**
 * 速報のカードのプレビュー（PNG）。?kind=pickup で注目のニュースのカード。時刻は開いた時刻（投稿するときは投稿の時刻に入れ直す）。
 * ?headline= で、入力中の見出し（改行で行を分ける）をカードに入れる（投稿するカードと同じ見た目を確かめるため）
 */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/breaking/[storyId]/card">) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { storyId } = await params;
  const [entry] = await loadEntries([{ position: 1, role: "MAIN", storyId, override: null }]);
  if (!entry) return Response.json({ error: "story not found" }, { status: 404 });
  const url = new URL(request.url);
  // 入力中の見出し（あれば、それをそのまま使う）
  const typed = (url.searchParams.get("headline") ?? "")
    .split("\n")
    .map((l) => l.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 4);
  if (typed.length) entry.headline = typed;
  // AI 解析前の出来事は見出しがまだないため、話題の見出しを下書きとして入れる（空のカードにしない）
  else if (entry.headline.length === 0) {
    const story = await prisma.story.findUnique({ where: { id: storyId }, select: { topic: { select: { title: true, aiTitle: true } } } });
    if (story) entry.headline = draftHeadline(story.topic);
  }
  const kind = url.searchParams.get("kind") === "pickup" ? "PICKUP" : "BREAKING";
  const image = await renderCard(buildBreakingCard(entry, new Date(), null, kind));
  image.headers.set("cache-control", "private, no-store");
  return image;
}
