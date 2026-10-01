import { hasCronSecret } from "@/lib/auth";
import { runScheduledPublish } from "@/lib/digest/autopublish";
import { SLOT_ORDER, type Slot } from "@/lib/digest/slots";

export const dynamic = "force-dynamic";

/**
 * 定時配信の投稿（投稿の時刻にスケジューラーが呼ぶ）。?slot=MORNING|LUNCH|EVENING
 * 承認済みなら投稿し、下書きのままなら見送る。
 */
export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const slot = new URL(request.url).searchParams.get("slot");
  if (!slot || !SLOT_ORDER.includes(slot as Slot)) {
    return Response.json({ error: "slot is required (MORNING, LUNCH or EVENING)" }, { status: 400 });
  }
  const result = await runScheduledPublish(slot as Slot);
  return Response.json(result, { status: result.result === "failed" ? 500 : 200 });
}
