import { hasCronSecret } from "@/lib/auth";
import { getEditionView } from "@/lib/digest/build";
import { buildCards } from "@/lib/digest/compose";
import { renderCard } from "@/lib/digest/cards";

export const dynamic = "force-dynamic";

/** 配信回のカード画像（PNG、1080×1080）。n = 0 が INDEX、1 以降が掲載順 */
export async function GET(request: Request, { params }: RouteContext<"/api/admin/editions/[id]/cards/[n]">) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, n } = await params;
  const found = await getEditionView(id);
  if (!found) return Response.json({ error: "edition not found" }, { status: 404 });
  const card = buildCards(found.view)[Number(n)];
  if (!card) return Response.json({ error: "card not found" }, { status: 404 });
  const image = await renderCard(card);
  image.headers.set("cache-control", "private, no-store");
  return image;
}
