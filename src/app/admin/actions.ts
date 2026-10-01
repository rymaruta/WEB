"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/admin/session";
import { isLocked, recordFailure, recordSuccess } from "@/lib/admin/rate-limit";
import {
  AdminError,
  addItem,
  approveEdition,
  confirmItem,
  editItem,
  moveItem,
  rebuild,
  removeItem,
  setPostText,
  unapproveEdition,
} from "@/lib/digest/admin";
import { revalidatePath } from "next/cache";

export type ActionState = { error?: string; ok?: string } | undefined;

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function login(_: ActionState, form: FormData): Promise<ActionState> {
  const key = await clientKey();
  if (isLocked(key)) return { error: "ログインの失敗が続いたため、15 分間ログインできません" };
  if (!passwordMatches(String(form.get("password") ?? ""))) {
    recordFailure(key);
    return { error: "パスワードが違います" };
  }
  recordSuccess(key);
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

/** 管理画面の操作の共通処理: ログインを確かめ、失敗を画面に返す */
async function run(editionId: string, fn: () => Promise<unknown>, ok?: string): Promise<ActionState> {
  await requireAdmin();
  try {
    await fn();
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/admin");
  return ok ? { ok } : undefined;
}

export async function moveAction(editionId: string, position: number, direction: -1 | 1) {
  return run(editionId, () => moveItem(editionId, position, direction));
}

export async function removeAction(editionId: string, storyId: string) {
  return run(editionId, () => removeItem(editionId, storyId));
}

export async function addAction(editionId: string, storyId: string) {
  return run(editionId, () => addItem(editionId, storyId), "追加しました");
}

export async function confirmAction(editionId: string, storyId: string, confirmed: boolean) {
  return run(editionId, () => confirmItem(editionId, storyId, confirmed));
}

export async function editAction(editionId: string, storyId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const lines = (name: string) =>
    String(form.get(name) ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  return run(
    editionId,
    () =>
      editItem(editionId, storyId, {
        headline: lines("headline"),
        shortTitle: String(form.get("shortTitle") ?? ""),
        keyword: String(form.get("keyword") ?? ""),
        points: lines("points"),
        why: String(form.get("why") ?? ""),
      }),
    "保存しました",
  );
}

export async function postTextAction(editionId: string, _: ActionState, form: FormData): Promise<ActionState> {
  if (form.get("restore")) return run(editionId, () => setPostText(editionId, null), "自動の文に戻しました");
  return run(editionId, () => setPostText(editionId, String(form.get("postText") ?? "").split("\n")), "保存しました");
}

export async function approveAction(editionId: string): Promise<ActionState> {
  return run(editionId, () => approveEdition(editionId), "承認しました。予定の時刻に投稿されます");
}

export async function unapproveAction(editionId: string): Promise<ActionState> {
  return run(editionId, () => unapproveEdition(editionId), "承認を取り消しました");
}

export async function rebuildAction(editionId: string): Promise<ActionState> {
  await requireAdmin();
  let id: string;
  try {
    id = await rebuild(editionId);
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin");
  redirect(`/admin/editions/${id}`);
}

/** まだ下書きのない回を、いまの候補から作る */
export async function buildAction(slot: "MORNING" | "LUNCH" | "EVENING") {
  await requireAdmin();
  const { buildEdition } = await import("@/lib/digest/build");
  const r = await buildEdition(slot);
  revalidatePath("/admin");
  redirect(`/admin/editions/${r.id}`);
}
