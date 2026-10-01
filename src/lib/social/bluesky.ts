/**
 * Bluesky（AT Protocol）の最小限のクライアント（投稿にだけ使う）。
 * 認証はアプリパスワード（Bluesky の設定 → アプリパスワードで発行）。無料。
 * 環境変数: BLUESKY_HANDLE（例: zenbu-navi.bsky.social）、BLUESKY_APP_PASSWORD
 */

const API = "https://bsky.social/xrpc";
const TIMEOUT_MS = 30_000;
/** 1投稿の文字数の上限（書記素の数） */
export const BLUESKY_MAX_GRAPHEMES = 300;
/** 画像1枚の上限（バイト） */
export const BLUESKY_MAX_IMAGE_BYTES = 1_000_000;

export type BlueskyCredentials = { handle: string; appPassword: string };
type Session = { accessJwt: string; did: string; handle: string };
type Blob = { $type: "blob"; ref: { $link: string }; mimeType: string; size: number };

export function blueskyCredentialsFromEnv(env: Record<string, string | undefined> = process.env): BlueskyCredentials | null {
  const handle = env.BLUESKY_HANDLE?.trim().replace(/^@/, "");
  const appPassword = env.BLUESKY_APP_PASSWORD?.trim();
  if (!handle || !appPassword || handle === "PLACEHOLDER" || appPassword === "PLACEHOLDER") return null;
  return { handle, appPassword };
}

async function call<T>(path: string, init: { body: BodyInit; contentType: string; token?: string }): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "content-type": init.contentType, ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bluesky ${path} が ${res.status} を返しました: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export async function createSession(c: BlueskyCredentials): Promise<Session> {
  return call<Session>("com.atproto.server.createSession", {
    contentType: "application/json",
    body: JSON.stringify({ identifier: c.handle, password: c.appPassword }),
  });
}

export async function uploadBlob(s: Session, data: Uint8Array, mimeType: string): Promise<Blob> {
  const r = await call<{ blob: Blob }>("com.atproto.repo.uploadBlob", { contentType: mimeType, body: Buffer.from(data), token: s.accessJwt });
  return r.blob;
}

export const graphemes = (s: string) => [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(s)].length;

/** 本文中の URL をリンクにする指定（位置は UTF-8 のバイト数で数える） */
export function linkFacets(text: string) {
  const enc = new TextEncoder();
  const facets = [];
  for (const m of text.matchAll(/https?:\/\/[^\s]+/g)) {
    const byteStart = enc.encode(text.slice(0, m.index)).length;
    facets.push({
      index: { byteStart, byteEnd: byteStart + enc.encode(m[0]).length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  return facets;
}

/** 画像付きで投稿し、投稿の URI（at://…）を返す */
export async function createPost(
  s: Session,
  text: string,
  images: { blob: Blob; alt: string; width: number; height: number }[],
  now = new Date(),
): Promise<string> {
  const facets = linkFacets(text);
  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: now.toISOString(),
    langs: ["ja"],
    ...(facets.length ? { facets } : {}),
    ...(images.length
      ? {
          embed: {
            $type: "app.bsky.embed.images",
            images: images.slice(0, 4).map((i) => ({ alt: i.alt, image: i.blob, aspectRatio: { width: i.width, height: i.height } })),
          },
        }
      : {}),
  };
  const r = await call<{ uri: string }>("com.atproto.repo.createRecord", {
    contentType: "application/json",
    body: JSON.stringify({ repo: s.did, collection: "app.bsky.feed.post", record }),
    token: s.accessJwt,
  });
  return r.uri;
}

/** 投稿の URI（at://did/app.bsky.feed.post/rkey）から、Web で開ける URL を作る */
export function blueskyPostUrl(uri: string, handle: string): string {
  const rkey = uri.split("/").pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}
