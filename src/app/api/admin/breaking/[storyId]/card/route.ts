import { hasAdminAccess } from "@/lib/auth";
import { loadEntries } from "@/lib/digest/build";
import { renderCard } from "@/lib/digest/cards";
import { buildBreakingCard } from "@/lib/digest/compose";

export const dynamic = "force-dynamic";

/** 速報のカードのプレビュー（PNG）。?kind=pickup で注目のニュースのカード。時刻は開いた時刻（投稿するときは投稿の時刻に入れ直す） */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/breaking/[storyId]/card">) {
  if (!(await hasAdminAccess(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { storyId } = await params;
  const [entry] = await loadEntries([{ position: 1, role: "MAIN", storyId, override: null }]);
  if (!entry) return Response.json({ error: "story not found" }, { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind") === "pickup" ? "PICKUP" : "BREAKING";
  const image = await renderCard(buildBreakingCard(entry, new Date(), null, kind));
  image.headers.set("cache-control", "private, no-store");
  return image;
}
