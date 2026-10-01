import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { LIMITS, type Sourced } from "@/lib/stories/schema";
import { textWidth } from "@/lib/stories/text";
import { checkOverride } from "./check";
import { buildEdition, loadCandidates, loadEntries, type ItemOverride } from "./build";
import { altText, buildCards, composePostText, replyText, splitParts } from "./compose";
import { REQUIRED_ITEMS, scoreCandidate } from "./select";
import { MAX_ITEMS, SLOTS, type Slot } from "./slots";

/**
 * 管理画面からの操作（並べ替え・追加・削除・編集・承認）。呼び出し側でログインを確かめてから使う。
 * 承認済み・投稿済みの配信回は変更できない（先に承認を取り消す）
 */

export class AdminError extends Error {}

type ItemRow = { position: number; storyId: string; role: "MAIN" | "FOLLOWUP"; score: number; override: Prisma.JsonValue; confirmed: boolean };

async function editableEdition(id: string) {
  const e = await prisma.edition.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!e) throw new AdminError("配信回が見つかりません");
  if (e.slot === "BREAKING") throw new AdminError("速報はこの画面では編集できません");
  if (e.status !== "DRAFT" && e.status !== "SKIPPED") throw new AdminError("承認済み・投稿済みの配信回は変更できません。先に承認を取り消してください");
  return e;
}

async function log(editionId: string, action: string, before?: unknown, after?: unknown, storyId?: string) {
  await prisma.reviewAction.create({
    data: {
      editionId,
      storyId,
      action,
      before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
      actor: "admin",
    },
  });
}

/** 掲載順を置き換える（本編を先、続報を後にそろえる）。投稿文は手で直していなければ作り直す */
async function rewriteItems(editionId: string, rows: ItemRow[]) {
  const ordered = [...rows.filter((r) => r.role === "MAIN"), ...rows.filter((r) => r.role === "FOLLOWUP")];
  const edition = await prisma.edition.findUniqueOrThrow({ where: { id: editionId } });
  const notes = (edition.notes ?? {}) as Record<string, unknown>;
  const entries = await loadEntries(ordered.map((r, i) => ({ position: i + 1, role: r.role, storyId: r.storyId, override: r.override })));
  await prisma.$transaction([
    prisma.editionItem.deleteMany({ where: { editionId } }),
    prisma.editionItem.createMany({
      data: ordered.map((r, i) => ({
        editionId,
        position: i + 1,
        storyId: r.storyId,
        role: r.role,
        score: r.score,
        override: r.override === null ? undefined : (r.override as Prisma.InputJsonValue),
        confirmed: r.confirmed,
      })),
    }),
    prisma.edition.update({
      where: { id: editionId },
      data: {
        status: ordered.length ? "DRAFT" : edition.status,
        ...(notes.postTextManual ? {} : { postText: composePostText(edition.slot as Slot, edition.date, entries) }),
      },
    }),
  ]);
}

export async function moveItem(editionId: string, position: number, direction: -1 | 1) {
  const e = await editableEdition(editionId);
  const rows = [...e.items];
  const i = rows.findIndex((r) => r.position === position);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length || rows[i].role !== rows[j].role) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await rewriteItems(editionId, rows);
  await log(editionId, "reorder", { position }, { position: position + direction }, rows[j].storyId);
}

export async function removeItem(editionId: string, storyId: string) {
  const e = await editableEdition(editionId);
  await rewriteItems(
    editionId,
    e.items.filter((r) => r.storyId !== storyId),
  );
  await log(editionId, "remove", { storyId }, undefined, storyId);
}

export async function addItem(editionId: string, storyId: string) {
  const e = await editableEdition(editionId);
  if (e.items.some((r) => r.storyId === storyId)) throw new AdminError("すでに載っています");
  if (e.items.length >= MAX_ITEMS) throw new AdminError(`1 回に載せられるのは ${MAX_ITEMS} 本までです`);
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { kind: true, status: true } });
  if (!story) throw new AdminError("ストーリーが見つかりません");
  if (!["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"].includes(story.status)) throw new AdminError("この状態のストーリーは載せられません");
  const role = story.kind === "FOLLOWUP" ? "FOLLOWUP" : "MAIN";
  await rewriteItems(editionId, [...e.items, { position: 0, storyId, role, score: 0, override: null, confirmed: false }]);
  await log(editionId, "add", undefined, { storyId }, storyId);
}

/** 人による編集。出典の番号は元の要点から引き継ぐ */
export async function editItem(editionId: string, storyId: string, input: { headline: string[]; shortTitle: string; keyword: string; points: string[]; why: string }) {
  const e = await editableEdition(editionId);
  const row = e.items.find((r) => r.storyId === storyId);
  if (!row) throw new AdminError("この配信回に載っていません");
  const [entry] = await loadEntries([{ position: row.position, role: row.role, storyId, override: null }]);
  const sourcesOf = (i: number) => entry.points[i]?.sources ?? entry.points[0]?.sources ?? [];
  const override: ItemOverride = {
    headline: input.headline.map((s) => s.trim()).filter(Boolean),
    shortTitle: input.shortTitle.trim(),
    keyword: input.keyword.trim(),
    points: input.points.map((t) => t.trim()).filter(Boolean).map((text, i): Sourced => ({ text, sources: sourcesOf(i) })),
    why: input.why.trim() ? { text: input.why.trim(), sources: entry.why?.sources ?? sourcesOf(0) } : null,
  };
  const problems = checkOverride(override);
  if (problems.length) throw new AdminError(problems.join("\n"));
  await rewriteItems(
    editionId,
    e.items.map((r) => (r.storyId === storyId ? { ...r, override: override as unknown as Prisma.JsonValue } : r)),
  );
  await log(editionId, "edit", row.override, override, storyId);
}

export async function confirmItem(editionId: string, storyId: string, confirmed: boolean) {
  const e = await editableEdition(editionId);
  const row = e.items.find((r) => r.storyId === storyId);
  if (!row) throw new AdminError("この配信回に載っていません");
  await prisma.editionItem.update({ where: { editionId_position: { editionId, position: row.position } }, data: { confirmed } });
  await log(editionId, confirmed ? "confirm" : "unconfirm", undefined, undefined, storyId);
}

export async function setPostText(editionId: string, lines: string[] | null) {
  const e = await editableEdition(editionId);
  const notes = (e.notes ?? {}) as Record<string, unknown>;
  if (lines === null) {
    // 自動の文に戻す
    const entries = await loadEntries(e.items.map((r) => ({ position: r.position, role: r.role, storyId: r.storyId, override: r.override })));
    await prisma.edition.update({
      where: { id: editionId },
      data: { postText: composePostText(e.slot as Slot, e.date, entries), notes: { ...notes, postTextManual: false } as Prisma.InputJsonValue },
    });
    return;
  }
  // 空行は区切りとして残す（前後の空行と、続けて並んだ空行だけ詰める）
  const clean = lines
    .map((l) => l.trim())
    .filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n")
    .trim()
    .split("\n");
  const filled = clean.filter(Boolean);
  if (filled.length < 1 || filled.length > LIMITS.postLines) throw new AdminError(`投稿文は1〜${LIMITS.postLines}行です`);
  const long = clean.filter((l) => textWidth(l) > LIMITS.postWidth);
  if (long.length) throw new AdminError(`1行は${LIMITS.postWidth}字までです`);
  if (textWidth(clean.join("\n")) > LIMITS.postTotalWidth) throw new AdminError(`投稿文は全体で${LIMITS.postTotalWidth}字までです`);
  await prisma.edition.update({ where: { id: editionId }, data: { postText: clean, notes: { ...notes, postTextManual: true } as Prisma.InputJsonValue } });
  await log(editionId, "post-text", e.postText, clean);
}

/**
 * 承認。要確認のストーリーは、すべて確認済みにしてからでないと承認できない。
 * 投稿の時刻を過ぎた回は、承認しても自動では投稿されないため、afterTime（今すぐ投稿する）のときだけ承認できる
 */
export async function approveEdition(editionId: string, now = new Date(), opts: { afterTime?: boolean } = {}) {
  const e = await editableEdition(editionId);
  if (e.items.length === 0) throw new AdminError("載せるニュースがありません");
  if (e.items.length !== REQUIRED_ITEMS) throw new AdminError(`1回の配信は${REQUIRED_ITEMS}本にしてください（いまは${e.items.length}本）。候補から追加してください`);
  if (now >= e.scheduledAt && !opts.afterTime) throw new AdminError("投稿の時刻を過ぎています。「この内容で今すぐ投稿する」を使ってください");
  const stories = await prisma.story.findMany({ where: { id: { in: e.items.map((i) => i.storyId) } }, select: { id: true, status: true } });
  const review = new Set(stories.filter((s) => s.status === "REVIEW_REQUIRED").map((s) => s.id));
  const unconfirmed = e.items.filter((i) => review.has(i.storyId) && !i.confirmed);
  if (unconfirmed.length) throw new AdminError(`要確認のニュースが ${unconfirmed.length} 本あります。内容を確かめて「確認した」を押してください`);
  await prisma.edition.update({ where: { id: editionId }, data: { status: "APPROVED", approvedAt: now, approvedBy: "admin" } });
  await log(editionId, "approve");
}

export async function unapproveEdition(editionId: string) {
  const e = await prisma.edition.findUnique({ where: { id: editionId } });
  if (!e || e.status !== "APPROVED") throw new AdminError("承認済みの配信回ではありません");
  await prisma.edition.update({ where: { id: editionId }, data: { status: "DRAFT", approvedAt: null, approvedBy: null } });
  await log(editionId, "unapprove");
}

/** 下書きを捨てて、いまの候補から選び直す */
export async function rebuild(editionId: string) {
  const e = await editableEdition(editionId);
  await prisma.edition.delete({ where: { id: editionId } });
  const result = await buildEdition(e.slot as Slot, new Date(Math.min(Date.now(), e.scheduledAt.getTime() - 60_000)));
  return result.id;
}

/** 配信回の詳細（画面表示用） */
export async function editionDetail(id: string) {
  const e = await prisma.edition.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!e || e.slot === "BREAKING") return null;
  const entries = await loadEntries(e.items.map((r) => ({ position: r.position, role: r.role, storyId: r.storyId, override: r.override })));
  const stories = await prisma.story.findMany({
    where: { id: { in: e.items.map((i) => i.storyId) } },
    select: { id: true, status: true, statusNote: true, riskFlags: true },
  });
  const byId = new Map(stories.map((s) => [s.id, s]));
  const view = { slot: e.slot as Slot, date: e.date, scheduledAt: e.scheduledAt, entries };
  const cards = buildCards(view);
  const parts = splitParts(entries.length).map((nos, i) => ({ text: i === 0 ? e.postText.join("\n") : replyText(entries, nos), cards: nos }));
  return {
    edition: e,
    items: e.items.map((r, i) => ({ ...r, entry: entries[i], story: byId.get(r.storyId) ?? null })),
    cards: cards.map((c) => ({ type: c.type, alt: altText(c) })),
    parts,
    title: SLOTS[e.slot as Slot].title,
  };
}

/** 追加できる候補（点数の高い順） */
export async function candidatePool(editionId: string) {
  const e = await prisma.edition.findUnique({ where: { id: editionId }, include: { items: true } });
  if (!e || e.slot === "BREAKING") return [];
  const cfg = SLOTS[e.slot as Slot];
  const since = new Date(e.scheduledAt.getTime() - cfg.windowHours * 3_600_000);
  const included = new Set(e.items.map((i) => i.storyId));
  const cands = (await loadCandidates(since, true)).filter((c) => !included.has(c.id));
  const stories = await prisma.story.findMany({
    where: { id: { in: cands.map((c) => c.id) } },
    select: { id: true, headline: true, shortTitle: true, category: true, status: true, kind: true },
  });
  const byId = new Map(stories.map((s) => [s.id, s]));
  return cands
    .map((c) => ({ ...scoreCandidate(c), story: byId.get(c.id)! }))
    .filter((c) => c.story)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

/**
 * 下書きを取り消す（削除する）。間違えて早く作った下書きなどに使う。
 * 取り消した回は、下書きを作る時刻になると自動で作り直される（時刻を過ぎていれば「下書きを今すぐ作る」から作れる）。
 */
export async function cancelEdition(editionId: string) {
  const e = await editableEdition(editionId);
  await prisma.edition.delete({ where: { id: editionId } });
  await logEvent("info", "digest.cancel", `${e.key}: 下書きを取り消しました`, editionId);
  return e;
}

/**
 * 投稿済みの回を出し直せる状態に戻す（運営者が X の投稿を削除したうえで、内容を直して投稿し直すとき）。
 * X への投稿の記録を消して下書きに戻す。X の投稿そのものは消さない（運営者が X で削除する）。
 */
export async function reopenForRepost(editionId: string) {
  const e = await prisma.edition.findUnique({ where: { id: editionId }, select: { key: true, slot: true, status: true } });
  if (!e) throw new AdminError("配信回が見つかりません");
  if (e.slot === "BREAKING") throw new AdminError("速報は出し直せません");
  if (e.status !== "PUBLISHED") throw new AdminError("投稿済みの回ではありません");
  await prisma.$transaction([
    prisma.publication.deleteMany({ where: { editionId } }),
    prisma.edition.update({ where: { id: editionId }, data: { status: "DRAFT", publishedAt: null, approvedAt: null, approvedBy: null } }),
  ]);
  await log(editionId, "reopen");
  await logEvent("warn", "digest.reopen", `${e.key}: 出し直すため下書きに戻しました（X の投稿は運営者が削除）`, editionId);
}

/** 話題の最新のストーリーを配信回に足す（管理用 API から）。confirm なら要確認のストーリーも確認済みにする */
export async function addTopicToEdition(editionId: string, topicId: number, confirm: boolean) {
  const story = await prisma.story.findFirst({
    where: { topicId, status: { in: ["PENDING", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!story) throw new AdminError("この話題には、載せられる解析済みのストーリーがありません");
  await addItem(editionId, story.id);
  if (confirm) await prisma.editionItem.updateMany({ where: { editionId, storyId: story.id }, data: { confirmed: true } });
  return story.id;
}
