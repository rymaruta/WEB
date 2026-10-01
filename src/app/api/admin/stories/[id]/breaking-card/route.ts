import { hasCronSecret } from "@/lib/auth";
import { loadEntries } from "@/lib/digest/build";
import { renderCard } from "@/lib/digest/cards";
import { buildBreakingCard } from "@/lib/digest/compose";

export const dynamic = "force-dynamic";

/**
 * ストーリーを速報カードにした場合の見本（PNG）。速報の承認前の確認に使う。
 * ?unknown= に「まだ分かっていないこと」を渡す（人が書く）
 */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/stories/[id]/breaking-card">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const [entry] = await loadEntries([{ position: 1, role: "MAIN", storyId: id, override: null }]);
  if (!entry) return Response.json({ error: "story not found" }, { status: 404 });
  const unknown = new URL(request.url).searchParams.get("unknown")?.trim().slice(0, 40) || null;
  const image = await renderCard(buildBreakingCard(entry, new Date(), unknown));
  image.headers.set("cache-control", "private, no-store");
  return image;
}
