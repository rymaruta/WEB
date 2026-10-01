import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Threads API の最小限のクライアント（投稿にだけ使う）。無料。
 *
 * アクセストークンは長期トークン（60日で切れる）。環境変数 THREADS_ACCESS_TOKEN を最初の値とし、
 * 定期的に延長した新しいトークンを Setting（threads.token）に保存して使う。
 * 環境変数を新しいトークンに入れ替えたときは、保存した値より環境変数を優先する。
 */

const API = "https://graph.threads.net/v1.0";
const TIMEOUT_MS = 30_000;
export const THREADS_MAX_CHARS = 500;
/** この日数より前に延長したトークンは延長し直す（期限は60日） */
const REFRESH_AFTER_DAYS = 7;
const SETTING_KEY = "threads.token";

type Stored = { token: string; base: string; refreshedAt: string; triedAt?: string };

const digest = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export function threadsConfigured(env: Record<string, string | undefined> = process.env): boolean {
  const t = env.THREADS_ACCESS_TOKEN?.trim();
  return Boolean(t && t !== "PLACEHOLDER");
}

async function readStored(): Promise<Stored | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  return (row?.value as Stored | undefined) ?? null;
}

/** いま使うトークン。未設定なら null */
export async function threadsToken(env: Record<string, string | undefined> = process.env): Promise<string | null> {
  if (!threadsConfigured(env)) return null;
  const envToken = env.THREADS_ACCESS_TOKEN!.trim();
  const stored = await readStored();
  return stored && stored.base === digest(envToken) ? stored.token : envToken;
}

/** 必要ならトークンを延長して保存する。延長した・不要だった・失敗した、を返す */
export async function refreshThreadsToken(now = new Date(), env: Record<string, string | undefined> = process.env) {
  if (!threadsConfigured(env)) return "not-configured" as const;
  const envToken = env.THREADS_ACCESS_TOKEN!.trim();
  const base = digest(envToken);
  const stored = await readStored();
  const current = stored && stored.base === base ? stored : null;
  const since = (iso: string) => now.getTime() - Date.parse(iso);
  if (current && since(current.refreshedAt) < REFRESH_AFTER_DAYS * 86_400_000) return "fresh" as const;
  // 失敗したときは1時間おく（発行から24時間たたないトークンは延長できない）
  if (current?.triedAt && since(current.triedAt) < 3_600_000) return "waiting" as const;

  const token = current?.token ?? envToken;
  const url = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
  const json = res?.ok ? ((await res.json()) as { access_token?: string }) : null;
  const value: Stored = json?.access_token
    ? { token: json.access_token, base, refreshedAt: now.toISOString() }
    : { token, base, refreshedAt: current?.refreshedAt ?? new Date(0).toISOString(), triedAt: now.toISOString() };
  await prisma.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
  return json?.access_token ? ("refreshed" as const) : ("failed" as const);
}

async function call<T>(token: string, path: string, params: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(method === "GET" ? `${API}${path}?${query}` : `${API}${path}`, {
    method,
    ...(method === "POST" ? { headers: { "content-type": "application/x-www-form-urlencoded" }, body: query } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  // エラーの本文にトークンは含まれないが、念のため伏せる
  if (!res.ok) throw new Error(`Threads ${path} が ${res.status} を返しました: ${text.replaceAll(token, "***").slice(0, 300)}`);
  return JSON.parse(text) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 投稿の準備が終わるまで待つ（Threads は公開前に待つことを勧めている） */
async function waitFinished(token: string, id: string, timeoutMs = 90_000) {
  const started = Date.now();
  for (;;) {
    const r = await call<{ status?: string; error_message?: string }>(token, `/${id}`, { fields: "status,error_message" }, "GET");
    if (r.status === "FINISHED") return;
    if (r.status === "ERROR" || r.status === "EXPIRED") throw new Error(`Threads の投稿の準備に失敗しました: ${r.error_message ?? r.status}`);
    if (Date.now() - started > timeoutMs) throw new Error("Threads の投稿の準備が時間内に終わりませんでした");
    await sleep(5_000);
  }
}

/** 文章に記事のリンク（プレビュー付き）を添えて投稿し、投稿の ID を返す */
export async function createThreadsPost(token: string, text: string, link?: string): Promise<string> {
  const { id } = await call<{ id: string }>(token, "/me/threads", { media_type: "TEXT", text, ...(link ? { link_attachment: link } : {}) });
  await waitFinished(token, id);
  return (await call<{ id: string }>(token, "/me/threads_publish", { creation_id: id })).id;
}
