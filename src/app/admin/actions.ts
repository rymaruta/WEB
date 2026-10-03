"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireAdmin, startSession } from "@/lib/admin/session";
import { isLocked, recordFailure, recordSuccess } from "@/lib/admin/rate-limit";
import {
  AdminError,
  addItem,
  approveEdition,
  bulkConfirm,
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

/** 要確認のニュースをまとめて点検し、問題のないものを確認済みにする */
export async function bulkConfirmAction(editionId: string): Promise<ActionState> {
  await requireAdmin();
  try {
    const { confirmed, remaining } = await bulkConfirm(editionId);
    revalidatePath(`/admin/editions/${editionId}`);
    revalidatePath("/admin");
    if (remaining.length === 0) return { ok: confirmed > 0 ? `${confirmed}本を確認済みにしました。残りはありません` : "確認が必要なニュースはありません" };
    return {
      ok: `${confirmed}本を確認済みにしました。次の${remaining.length}本は中身に気になる点があるため、確かめてください：${remaining.map((r) => `「${r.headline}」（${r.reasons.join("・")}）`).join(" ")}`,
    };
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message };
    throw e;
  }
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

/** 投稿の時刻を過ぎた下書きを、承認していますぐ投稿する（カードの時刻は投稿した時刻になる） */
export async function publishAfterTimeAction(editionId: string): Promise<ActionState> {
  await requireAdmin();
  const { publishEdition, PublishError } = await import("@/lib/digest/publish");
  try {
    await approveEdition(editionId, new Date(), { afterTime: true });
    await publishEdition(editionId);
  } catch (e) {
    if (e instanceof AdminError || e instanceof PublishError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/admin");
  return { ok: "X に投稿しました" };
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

/** 承認済みの配信回を、いますぐ X に投稿する */
export async function publishNowAction(editionId: string): Promise<ActionState> {
  await requireAdmin();
  const { publishEdition, PublishError } = await import("@/lib/digest/publish");
  try {
    await publishEdition(editionId);
  } catch (e) {
    if (e instanceof PublishError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/admin");
  return { ok: "X に投稿しました" };
}

/** Bluesky の接続を確かめる（投稿はしない） */
export async function checkBlueskyAction(): Promise<ActionState> {
  await requireAdmin();
  const { blueskyCredentialsFromEnv, createSession } = await import("@/lib/social/bluesky");
  const creds = blueskyCredentialsFromEnv();
  if (!creds) return { error: "Bluesky の認証情報（BLUESKY_HANDLE・BLUESKY_APP_PASSWORD）が設定されていません" };
  try {
    const s = await createSession(creds);
    return { ok: `接続できました（@${s.handle}）` };
  } catch (e) {
    return { error: `接続できませんでした。ハンドルとアプリパスワードを確認してください。\n${e instanceof Error ? e.message : e}` };
  }
}

/** Threads の接続を確かめる（投稿はしない） */
export async function checkThreadsAction(): Promise<ActionState> {
  await requireAdmin();
  const { threadsAccount, threadsToken } = await import("@/lib/social/threads");
  const token = await threadsToken();
  if (!token) return { error: "Threads のアクセストークン（THREADS_ACCESS_TOKEN）が設定されていません" };
  try {
    return { ok: `接続できました（@${await threadsAccount(token)}）` };
  } catch (e) {
    return { error: `接続できませんでした。アクセストークンが有効か確認してください。\n${e instanceof Error ? e.message : e}` };
  }
}

/** Threads の今日の1本を、時刻を待たずに投稿する（今日の分を投稿済みなら何もしない） */
export async function threadsDailyNowAction(): Promise<ActionState> {
  await requireAdmin();
  const { runThreadsDaily } = await import("@/lib/digest/threads-daily");
  const r = await runThreadsDaily();
  revalidatePath("/admin");
  switch (r.result) {
    case "published":
      return { ok: "Threads に投稿しました" };
    case "already-published":
      return { ok: "今日の分は投稿済みです" };
    case "none":
      return { error: "今日 X に載せたニュースに、Threads に載せられるもの（AI まとめ記事があるもの）がありません" };
    case "not-configured":
      return { error: "Threads のアクセストークンが設定されていません" };
    default:
      return { error: `投稿に失敗しました。\n${r.error}` };
  }
}

/** この回の Bluesky への投稿をやり直す（再試行の回数を戻してから投稿する） */
export async function retryBlueskyAction(editionId: string): Promise<ActionState> {
  await requireAdmin();
  const { prisma } = await import("@/lib/db");
  const { crossPostEdition } = await import("@/lib/digest/crosspost");
  await prisma.publication.updateMany({ where: { editionId, channel: "BLUESKY", status: { not: "PUBLISHED" } }, data: { attempts: 0, status: "FAILED" } });
  const r = await crossPostEdition(editionId, "BLUESKY");
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/admin");
  if (r === "published" || r === "already-published") return { ok: "Bluesky に投稿しました" };
  if (r === "running") return { error: "投稿中です。少し待ってから画面を開き直してください" };
  if (r === "skipped") return { error: "X に投稿済みの回だけを投稿できます" };
  return { error: "投稿に失敗しました。理由は画面の表示か「記録」を確認してください" };
}

/** 選んだ出来事を、いますぐ速報として X に投稿する（投稿文とカードの時刻は投稿した時刻になる） */
export async function publishBreakingAction(storyId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return doPublishBreaking(storyId, form);
}

/** 出来事に AI 解析の要点があるか（なければ、見出しだけのカードになる） */
async function storyHasPoints(storyId: string): Promise<boolean> {
  const { prisma } = await import("@/lib/db");
  const s = await prisma.story.findUnique({ where: { id: storyId }, select: { points: true } });
  return Array.isArray(s?.points) && s.points.length > 0;
}

/** 選んだ出来事を、いますぐ注目のニュース（速報の表示なし）として X に投稿する。自動では出さず、ここからだけ出す */
export async function publishPickupAction(storyId: string, _: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const { prisma } = await import("@/lib/db");
  const { createPickup } = await import("@/lib/digest/breaking");
  const { checkSingleHeadline } = await import("@/lib/digest/check");
  const headline = String(form.get("headline") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const layout = form.get("layout") === "points" ? "points" : "headline";
  const hasPoints = await storyHasPoints(storyId);
  // 要点のない出来事は、見出しだけのカードになる
  const big = layout === "headline" || !hasPoints;
  const problems = headline.length ? checkSingleHeadline(headline, !big) : [];
  if (problems.length) return { error: problems.join("\n") };
  const { editionKey, jstDate } = await import("@/lib/digest/slots");
  const { publishEdition, PublishError } = await import("@/lib/digest/publish");
  // 失敗した回の出し直しは、同じ回の続きとして投稿する（二重に投稿しない）
  const existing = await prisma.edition.findUnique({ where: { key: editionKey(jstDate(new Date()), "PICKUP", storyId) }, select: { id: true, status: true } });
  if (existing?.status === "PUBLISHED") return { error: "この出来事は、今日すでに注目のニュースとして投稿しています" };
  const editionId = existing?.id ?? (await createPickup(storyId, new Date(), headline.length ? headline : undefined, big ? "headline" : "points"))?.id;
  if (!editionId) return { error: headline.length ? "回を作れませんでした。画面を開き直してください" : "見出しを入力してください" };
  try {
    const r = await publishEdition(editionId);
    revalidatePath("/admin/pickup");
    const url = r.status === "published" && r.firstPostId ? `\nhttps://x.com/i/web/status/${r.firstPostId}` : "";
    return { ok: `注目のニュースとして X に投稿しました${url}` };
  } catch (e) {
    if (e instanceof PublishError) return { error: `${e.message}\nもう一度押すと、続きから投稿します。` };
    throw e;
  }
}

/** メールのリンク（署名付き・期限つき）から、ログインせずに速報を投稿する */
export async function quickPublishAction(token: string, _: ActionState, form: FormData): Promise<ActionState> {
  const { verifyActionToken } = await import("@/lib/admin/token");
  const storyId = verifyActionToken(token);
  if (!storyId) return { error: "リンクの有効期限が切れました。管理画面から操作してください" };
  return doPublishBreaking(storyId, form);
}

async function doPublishBreaking(storyId: string, form: FormData): Promise<ActionState> {
  const { prisma } = await import("@/lib/db");
  const { createManualBreaking } = await import("@/lib/digest/breaking");
  const { checkSingleHeadline } = await import("@/lib/digest/check");
  // 見出しは投稿の前に直せる（カードと投稿文の両方に使う）
  const headline = String(form.get("headline") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const layout = form.get("layout") === "points" ? "points" : "headline";
  const hasPoints = await storyHasPoints(storyId);
  // 要点のない出来事は、見出しだけのカードになる
  const big = layout === "headline" || !hasPoints;
  const problems = headline.length ? checkSingleHeadline(headline, !big) : [];
  if (problems.length) return { error: problems.join("\n") };
  const { editionKey, jstDate } = await import("@/lib/digest/slots");
  const { publishEdition, PublishError } = await import("@/lib/digest/publish");
  // 失敗した速報の出し直しは、同じ回の続きとして投稿する（二重に投稿しない）
  const existing = await prisma.edition.findUnique({ where: { key: editionKey(jstDate(new Date()), "BREAKING", storyId) }, select: { id: true, status: true } });
  if (existing?.status === "PUBLISHED") return { error: "この出来事の速報は、今日すでに投稿しています" };
  const editionId = existing?.id ?? (await createManualBreaking(storyId, new Date(), headline.length ? headline : undefined, big ? "headline" : "points"))?.id;
  if (!editionId) return { error: headline.length ? "速報を作れませんでした。画面を開き直してください" : "見出しを入力してください" };
  try {
    const r = await publishEdition(editionId);
    revalidatePath("/admin/breaking");
    const url = r.status === "published" && r.firstPostId ? `\nhttps://x.com/i/web/status/${r.firstPostId}` : "";
    return { ok: `速報を X に投稿しました${url}` };
  } catch (e) {
    if (e instanceof PublishError) return { error: `${e.message}\nもう一度押すと、続きから投稿します。` };
    throw e;
  }
}

/** 「AI に確認させて投稿」: 速報用の解析（無料の定期実行）を今すぐ起動し、AI が確かめて問題なければ自動で投稿する */
export async function requestAiBreakingAction(storyId: string): Promise<ActionState> {
  await requireAdmin();
  return doRequestAi(storyId);
}

/** メールのリンク（署名付き・期限つき）から、ログインせずに「AI に確認させて投稿」を頼む */
export async function quickAiAction(token: string): Promise<ActionState> {
  const { verifyActionToken } = await import("@/lib/admin/token");
  const storyId = verifyActionToken(token);
  if (!storyId) return { error: "リンクの有効期限が切れました。管理画面から操作してください" };
  return doRequestAi(storyId);
}

async function doRequestAi(storyId: string): Promise<ActionState> {
  const { prisma } = await import("@/lib/db");
  const { logEvent } = await import("@/lib/events");
  const { REQUEST_SCOPE } = await import("@/lib/digest/breaking");
  const { fireBreakingRoutine, routineFireReady } = await import("@/lib/digest/routine");
  if (!routineFireReady()) return { error: "起動用のトークンが未設定です（Parameter Store の /zenbu-navi/ROUTINE_FIRE_TOKEN）" };
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, topic: { select: { id: true, title: true } } } });
  if (!story) return { error: "出来事が見つかりません。画面を開き直してください" };
  const already = await prisma.eventLog.count({ where: { scope: REQUEST_SCOPE, ref: storyId, at: { gte: new Date(Date.now() - 30 * 60_000) } } });
  if (already) return { ok: "AI が確認中です。数分で結果が出ます（投稿されるか、見送りの理由がメールで届きます）" };
  try {
    await fireBreakingRoutine({ storyId, topicId: story.topic.id, title: story.topic.title });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  await logEvent("info", REQUEST_SCOPE, `AI に確認を依頼: ${story.topic.title}`, storyId);
  return { ok: "AI に確認を頼みました。3〜5分で、問題なければ自動で投稿します（見送りのときは理由をメールで知らせます）" };
}

/** 「AI に頼む」: 頼みたい作業を保存し、何でも頼める作業（無料の定期実行）を今すぐ起動する */
export async function createTaskAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const prompt = String(form.get("prompt") ?? "").trim();
  if (prompt.length < 2) return { error: "頼みたいことを書いてください" };
  if (prompt.length > 4000) return { error: "4000字以内で書いてください" };
  const { prisma } = await import("@/lib/db");
  const { fireRoutine, routineReady } = await import("@/lib/digest/routine");
  if (!routineReady("tasks")) return { error: "起動用のトークンが未設定です（Parameter Store の /zenbu-navi/ROUTINE_TOKEN_TASKS）" };
  // 連打で同じ作業が並ばないよう、1時間に20件まで
  const recent = await prisma.adminTask.count({ where: { createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= 20) return { error: "1時間に頼めるのは20件までです。少し待ってから頼んでください" };
  const task = await prisma.adminTask.create({ data: { prompt }, select: { id: true } });
  try {
    const { sessionUrl } = await fireRoutine("tasks", JSON.stringify({ request: "admin-task", taskId: task.id }));
    await prisma.adminTask.update({ where: { id: task.id }, data: { sessionUrl } });
  } catch (e) {
    await prisma.adminTask.update({ where: { id: task.id }, data: { status: "failed", result: e instanceof Error ? e.message : String(e) } });
    revalidatePath("/admin/tasks");
    return { error: "AI を起動できませんでした。理由は一覧に出ています" };
  }
  revalidatePath("/admin/tasks");
  return { ok: "AI に頼みました。数分〜数十分で、この画面とメールに結果が届きます" };
}

/** 下書きを取り消す。取り消した回は、下書きを作る時刻に自動で作り直される */
export async function cancelAction(editionId: string): Promise<ActionState> {
  await requireAdmin();
  const { cancelEdition } = await import("@/lib/digest/admin");
  try {
    await cancelEdition(editionId);
  } catch (e) {
    if (e instanceof AdminError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin");
  redirect("/admin");
}
