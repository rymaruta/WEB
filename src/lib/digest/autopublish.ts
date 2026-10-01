import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { publishEdition } from "./publish";
import { autoApproveEnabled, editionKey, jstDate, SLOTS, type Slot } from "./slots";

export type ScheduledResult =
  | { result: "published"; editionId: string }
  | { result: "skipped"; editionId: string }
  | { result: "failed"; editionId: string; error: string }
  | { result: "noop"; editionId?: string; status?: string };

/**
 * 投稿の時刻に呼ぶ。今日のその回が
 * - 承認済み → X に投稿する
 * - 下書きのまま → おまかせ投稿なら、人の確認が要るニュースが残っていない限り承認して投稿する。
 *   おまかせ投稿でない、または確認待ちが残っている場合は見送る（SKIPPED）
 * - それ以外（投稿済み・見送り済み・失敗）→ 何もしない（失敗は人が確かめてから再実行する）
 */
export async function runScheduledPublish(slot: Slot, now = new Date()): Promise<ScheduledResult> {
  const name = SLOTS[slot].title;
  const edition = await prisma.edition.findUnique({ where: { key: editionKey(jstDate(now), slot) }, select: { id: true, key: true, status: true } });
  if (!edition) {
    await notifyOwner({
      title: `${name}を投稿できませんでした`,
      what: `${name}の下書きが作られていなかったため、投稿しませんでした。`,
      action: "急ぎでは不要です。続くようであれば、管理画面の「ログ」を確認してください。",
    });
    return { result: "noop" };
  }

  if (edition.status === "DRAFT" && autoApproveEnabled()) {
    // 管理画面で後から足した要確認のニュースが、確認されないまま残っていれば出さない
    const unconfirmed = await prisma.editionItem.count({
      where: { editionId: edition.id, confirmed: false, story: { status: "REVIEW_REQUIRED" } },
    });
    const items = await prisma.editionItem.count({ where: { editionId: edition.id } });
    if (unconfirmed === 0 && items > 0) {
      await prisma.edition.update({ where: { id: edition.id }, data: { status: "APPROVED" } });
      await logEvent("info", "digest.auto-approve", `${edition.key}: おまかせ投稿で承認しました`, edition.id);
      edition.status = "APPROVED";
    }
  }

  if (edition.status === "APPROVED") {
    try {
      await publishEdition(edition.id);
      return { result: "published", editionId: edition.id };
    } catch (e) {
      // 失敗の記録（FAILED と理由）は publishEdition が残す
      const error = e instanceof Error ? e.message : String(e);
      await notifyOwner({
        title: `${name}の投稿に失敗しました`,
        what: `${name}を X に投稿しようとしましたが、失敗しました。`,
        action: "管理画面でこの回を開き、「続きを投稿する」を押してください。すでに送った分が重複して投稿されることはありません。",
        detail: error.slice(0, 300),
      });
      return { result: "failed", editionId: edition.id, error };
    }
  }

  if (edition.status === "DRAFT") {
    await prisma.edition.update({ where: { id: edition.id }, data: { status: "SKIPPED" } });
    await logEvent("warn", "digest.skip", `${edition.key}: 承認されなかった（または確認待ちのニュースが残っていた）ため見送りました`, edition.id);
    await notifyOwner({
      title: `${name}を見送りました`,
      what: `${name}は、確認待ちのニュースが残っていたため投稿を見送りました。内容を確かめていないニュースを出さないための仕組みです。`,
      action: "不要です。次の回は通常どおり投稿されます。",
    });
    return { result: "skipped", editionId: edition.id };
  }

  if (edition.status === "SKIPPED") {
    await notifyOwner({
      title: `${name}を見送りました`,
      what: `${name}は、載せられるニュースが足りなかったため投稿を見送りました。`,
      action: "不要です。次の回は通常どおり投稿されます。",
    });
  }
  return { result: "noop", editionId: edition.id, status: edition.status };
}
