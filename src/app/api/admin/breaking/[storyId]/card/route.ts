import { hasAdminAccess } from "@/lib/auth";
import { loadEntries } from "@/lib/digest/build";
import { renderCard } from "@/lib/digest/cards";
import { draftHeadline } from "@/lib/digest/breaking";
import { buildBreakingCard } from "@/lib/digest/compose";
import { prisma } from "@/lib/db";

/** プレビュー用に、長い見出しを12字ずつの行に分ける（3行まで。投稿の前に人が直す） */
const previewLines = (text: string) => (text.match(/.{1,12}/gu) ?? [text]).slice(0, 3);

export const dynamic = "force-dynamic";

/** 速報のカードのプレビュー（PNG）。?kind=pickup で注目のニュースのカード。時刻は開いた時刻（投稿するときは投稿の時刻に入れ直す） */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/breaking/[storyId]/card">) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { storyId } = await params;
  const [entry] = await loadEntries([{ position: 1, role: "MAIN", storyId, override: null }]);
  if (!entry) return Response.json({ error: "story not found" }, { status: 404 });
  // AI 解析前の出来事は見出しがまだないため、話題の見出しを下書きとして入れる（空のカードにしない）
  if (entry.headline.length === 0) {
    const story = await prisma.story.findUnique({ where: { id: storyId }, select: { topic: { select: { title: true, aiTitle: true } } } });
    if (story) entry.headline = previewLines(draftHeadline(story.topic).join(""));
  }
  const kind = new URL(request.url).searchParams.get("kind") === "pickup" ? "PICKUP" : "BREAKING";
  const image = await renderCard(buildBreakingCard(entry, new Date(), null, kind));
  image.headers.set("cache-control", "private, no-store");
  return image;
}
