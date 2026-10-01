import { createHmac, randomBytes } from "node:crypto";

/**
 * OAuth 1.0a の署名（HMAC-SHA1）。X API をアプリ所有者のアカウントとして呼ぶために使う。
 * JSON の本文は署名の対象外（RFC 5849: form-urlencoded の本文だけが対象）。
 */

export type OAuthCredentials = { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string };

/** RFC 3986 のパーセントエンコード（encodeURIComponent が残す !'()* も変換する） */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signature(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const normalized = Object.entries(params)
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : 1) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(normalized)].join("&");
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

/** Authorization ヘッダー。url のクエリ文字列も署名に含める */
export function authorizationHeader(method: string, rawUrl: string, creds: OAuthCredentials, now = Date.now(), nonce = randomBytes(16).toString("hex")): string {
  const url = new URL(rawUrl);
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(now / 1000)),
    oauth_token: creds.token,
    oauth_version: "1.0",
  };
  const query = Object.fromEntries(url.searchParams.entries());
  const sig = signature(method, `${url.origin}${url.pathname}`, { ...query, ...oauth }, creds.consumerSecret, creds.tokenSecret);
  const fields = { ...oauth, oauth_signature: sig };
  return (
    "OAuth " +
    Object.entries(fields)
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ")
  );
}
