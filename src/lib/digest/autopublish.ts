import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { publishEdition } from "./publish";
import { editionKey, jstDate, type Slot } from "./slots";

export type ScheduledResult =
  | { result: "published"; editionId: string }
  | { result: "skipped"; editionId: string }
  | { result: "failed"; editionId: string; error: string }
  | { result: "noop"; editionId?: string; status?: string };

/**
 * 投稿の時刻に呼ぶ。今日のその回が
 * - 承認済み → X に投稿する
 * - 下書きのまま → 承認の締め切りを過ぎたので見送る（SKIPPED）
 * - それ以外（投稿済み・見送り済み・失敗）→ 何もしない（失敗は人が確かめてから再実行する）
 */
export async function runScheduledPublish(slot: Slot, now = new Date()): Promise<ScheduledResult> {
  const edition = await prisma.edition.findUnique({ where: { key: editionKey(jstDate(now), slot) }, select: { id: true, key: true, status: true } });
  if (!edition) return { result: "noop" };

  if (edition.status === "APPROVED") {
    try {
      await publishEdition(edition.id);
      return { result: "published", editionId: edition.id };
    } catch (e) {
      // 失敗の記録（FAILED と理由）は publishEdition が残す
      return { result: "failed", editionId: edition.id, error: e instanceof Error ? e.message : String(e) };
    }
  }

  if (edition.status === "DRAFT") {
    await prisma.edition.update({ where: { id: edition.id }, data: { status: "SKIPPED" } });
    await logEvent("warn", "digest.skip", `${edition.key}: 締め切りまでに承認されなかったため見送りました`, edition.id);
    return { result: "skipped", editionId: edition.id };
  }

  return { result: "noop", editionId: edition.id, status: edition.status };
}
