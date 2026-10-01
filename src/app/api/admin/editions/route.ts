import { hasCronSecret } from "@/lib/auth";
import { getEditionView } from "@/lib/digest/build";
import { altText, buildCards, splitParts, replyText } from "@/lib/digest/compose";
import { jstDate } from "@/lib/digest/slots";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 配信回の一覧（?date=YYYY-MM-DD、既定は今日）。投稿文・投稿の分け方・カードと代替テキスト・選定の記録を返す。
 * 管理画面（M2）と、承認前の確認に使う
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const date = new URL(request.url).searchParams.get("date") ?? jstDate(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "invalid date" }, { status: 400 });
  const editions = await prisma.edition.findMany({ where: { date }, orderBy: { scheduledAt: "asc" }, select: { id: true } });
  const result = [];
  for (const { id } of editions) {
    const found = await getEditionView(id);
    if (!found) continue;
    const { edition, view } = found;
    const cards = buildCards(view);
    const parts = splitParts(view.entries.length).map((cardNos, i) => ({
      position: i,
      text: i === 0 ? edition.postText.join("\n") : replyText(view.entries, cardNos),
      cards: cardNos,
    }));
    result.push({
      id: edition.id,
      key: edition.key,
      slot: edition.slot,
      status: edition.status,
      scheduledAt: edition.scheduledAt,
      deadlineAt: edition.deadlineAt,
      postText: edition.postText,
      notes: edition.notes,
      parts,
      cards: cards.map((card, n) => ({ n, type: card.type, alt: altText(card), image: `/api/admin/editions/${edition.id}/cards/${n}` })),
      items: view.entries,
    });
  }
  return Response.json({ date, editions: result });
}
