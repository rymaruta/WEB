import { authorizationHeader, type OAuthCredentials } from "./oauth1";

/**
 * X API v2 の最小限のクライアント（投稿にだけ使う）。認証は OAuth 1.0a（アプリ所有者のアカウント）。
 * 料金（2026年10月時点）: 投稿 $0.015、URL 付き投稿 $0.20、メディアのメタデータ（代替テキスト） $0.005
 */

const API = "https://api.x.com/2";
const TIMEOUT_MS = 30_000;

export class XApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSec: number | null,
  ) {
    super(message);
  }
}

export function credentialsFromEnv(env: Record<string, string | undefined> = process.env): OAuthCredentials | null {
  const c = {
    consumerKey: env.X_CONSUMER_KEY ?? "",
    consumerSecret: env.X_CONSUMER_SECRET ?? "",
    token: env.X_ACCESS_TOKEN ?? "",
    tokenSecret: env.X_ACCESS_TOKEN_SECRET ?? "",
  };
  const ok = Object.values(c).every((v) => v && v !== "PLACEHOLDER");
  return ok ? c : null;
}

async function call<T>(creds: OAuthCredentials, path: string, body: unknown): Promise<T> {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: authorizationHeader("POST", url, creds), "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    const reset = Number(res.headers.get("x-rate-limit-reset"));
    const retryAfter = res.status === 429 && reset ? Math.max(1, reset - Math.floor(Date.now() / 1000)) : null;
    throw new XApiError(`X API ${path} が ${res.status} を返しました: ${text.slice(0, 300)}`, res.status, retryAfter);
  }
  return JSON.parse(text) as T;
}

/** 画像を 1 回でアップロードし、メディア ID を返す */
export async function uploadImage(creds: OAuthCredentials, png: ArrayBuffer): Promise<string> {
  const r = await call<{ data: { id: string } }>(creds, "/media/upload", {
    media: Buffer.from(png).toString("base64"),
    media_category: "tweet_image",
  });
  return r.data.id;
}

/** 画像の代替テキスト（読み上げ用、1000 字まで） */
export async function setAltText(creds: OAuthCredentials, mediaId: string, text: string): Promise<void> {
  await call(creds, "/media/metadata", { id: mediaId, metadata: { alt_text: { text: [...text].slice(0, 1000).join("") } } });
}

/** 投稿する。replyTo を渡すと、その投稿への返信（自分のスレッドの続き）になる */
export async function createPost(creds: OAuthCredentials, text: string, mediaIds: string[], replyTo?: string): Promise<string> {
  const r = await call<{ data: { id: string } }>(creds, "/tweets", {
    text,
    ...(mediaIds.length ? { media: { media_ids: mediaIds } } : {}),
    ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}),
  });
  return r.data.id;
}

export const PRICES = { post: 0.015, mediaMetadata: 0.005 } as const;
