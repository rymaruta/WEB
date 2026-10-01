import { hasCronSecret } from "@/lib/auth";
import { buildEdition, currentSlot } from "@/lib/digest/build";
import { SLOT_ORDER, type Slot } from "@/lib/digest/slots";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * 定時配信の下書きを作る（投稿はしない）。?slot=MORNING|LUNCH|EVENING で回を指定する。
 * 指定がなければ、いまの時刻に作るべき回（下書きの時刻から投稿の時刻まで）を作る。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const param = new URL(request.url).searchParams.get("slot");
  const slot = param ? (SLOT_ORDER.includes(param as Slot) ? (param as Slot) : undefined) : (currentSlot(new Date()) ?? undefined);
  if (!slot) return Response.json({ error: "slot is required (MORNING, LUNCH or EVENING)" }, { status: 400 });
  try {
    return Response.json(await buildEdition(slot));
  } catch (e) {
    await logEvent("error", "digest.build", `${slot}: 下書きの作成に失敗`, undefined, String(e));
    await notifyOwner(`${slot} の下書きの作成に失敗しました。このままだと投稿されません。\n${String(e).slice(0, 200)}`);
    return Response.json({ error: "build failed" }, { status: 500 });
  }
}
