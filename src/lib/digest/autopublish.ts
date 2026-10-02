import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { editionQualityProblems } from "./check";
import { publishEdition } from "./publish";
import { REQUIRED_ITEMS } from "./select";
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
export async function runScheduledPublish(slot: Slot, now = new Date(), opts: { catchUp?: boolean } = {}): Promise<ScheduledResult> {
  const name = SLOTS[slot].title;
  const edition = await prisma.edition.findUnique({ where: { key: editionKey(jstDate(now), slot) }, select: { id: true, key: true, status: true } });
  // 起動直後の取りこぼし確認：投稿待ち（承認済み・下書き）の回だけを扱い、それ以外では何もせず知らせもしない
  if (opts.catchUp && (!edition || (edition.status !== "APPROVED" && edition.status !== "DRAFT"))) {
    return { result: "noop", editionId: edition?.id, status: edition?.status };
  }
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
    // 投稿前の品質チェック。全部が同じ分野（例：全部サッカー）・同じ出来事の重複・見出しや出典の欠けがあれば自動では出さない
    const rows = await prisma.editionItem.findMany({
      where: { editionId: edition.id },
      orderBy: { position: "asc" },
      select: { story: { select: { category: true, eventThreadId: true, headline: true, _count: { select: { sources: true } } } } },
    });
    const quality = editionQualityProblems(
      rows.map((r) => ({ category: r.story.category, threadId: r.story.eventThreadId, headline: r.story.headline, sources: r.story._count.sources })),
    );
    for (const w of quality.warnings) await logEvent("warn", "digest.quality-warn", `${edition.key}: ${w}`, edition.id);
    const blocked = quality.blocking.length > 0;
    if (blocked) {
      await logEvent("warn", "digest.quality", `${edition.key}: ${quality.blocking.join("、")}のため、自動では出しません`, edition.id);
      await notifyOwner({
        title: `${name}は品質チェックで止めたため、自動では投稿しません`,
        what: `${name}: ${quality.blocking.join("、")}。`,
        action: "出す場合は、管理画面でこの回を開き、ニュースを入れ替えてから投稿してください。",
      });
    }
    // 1回の配信は必ず3本（REQUIRED_ITEMS）。そろっていない回は自動では出さない
    if (unconfirmed === 0 && items === REQUIRED_ITEMS && !blocked) {
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
    const items = await prisma.editionItem.count({ where: { editionId: edition.id } });
    const short = items !== REQUIRED_ITEMS;
    await prisma.edition.update({ where: { id: edition.id }, data: { status: "SKIPPED" } });
    await logEvent(
      "warn",
      "digest.skip",
      short ? `${edition.key}: ${REQUIRED_ITEMS}本そろわなかった（${items}本）ため見送りました` : `${edition.key}: 承認されなかった（または確認待ちのニュースが残っていた）ため見送りました`,
      edition.id,
    );
    await notifyOwner({
      title: `${name}を見送りました`,
      what: short
        ? `${name}は、載せられるニュースが${items}本しかなく、${REQUIRED_ITEMS}本そろわなかったため投稿を見送りました。`
        : `${name}は、確認待ちのニュースが残っていたため投稿を見送りました。内容を確かめていないニュースを出さないための仕組みです。`,
      action: short
        ? `出す場合は、管理画面でこの回を開き、候補から足して${REQUIRED_ITEMS}本にしてから「この内容で今すぐ投稿する」を押してください。カードの時刻は投稿した時刻になります。`
        : "不要です。次の回は通常どおり投稿されます。",
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
