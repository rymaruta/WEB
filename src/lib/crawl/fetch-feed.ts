import { siteConfig } from "@/config/site";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;

export type FetchResult =
  | { status: "not-modified" }
  | { status: "ok"; body: string; etag: string | null; lastModified: string | null };

export type Conditional = { etag?: string | null; lastModified?: string | null };

function detectEncoding(contentType: string | null, head: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader;
  const decl = new TextDecoder("ascii").decode(head.subarray(0, 200));
  return decl.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8";
}

export async function fetchFeed(url: string, cond: Conditional = {}): Promise<FetchResult> {
  // このサイトが作る気象庁の RSS は、自分のサイトへ HTTP で取りに行かずに直接作る
  // （サーバーから自分の公開 URL に届かず、取得エラーになっていた。2026-10-08）
  const { isJmaFeedUrl, buildJmaRss } = await import("@/lib/jma-feed");
  if (isJmaFeedUrl(url)) return { status: "ok", body: await buildJmaRss(), etag: null, lastModified: null };
  const headers: Record<string, string> = {
    "User-Agent": siteConfig.crawlerUserAgent,
    Accept: "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
  };
  if (cond.etag) headers["If-None-Match"] = cond.etag;
  if (cond.lastModified) headers["If-Modified-Since"] = cond.lastModified;

  const res = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (res.status === 304) return { status: "not-modified" };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) throw new Error(`サイズ超過 (${declared} bytes)`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`サイズ超過 (${buf.byteLength} bytes)`);

  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(detectEncoding(res.headers.get("content-type"), buf));
  } catch {
    decoder = new TextDecoder("utf-8");
  }

  return {
    status: "ok",
    body: decoder.decode(buf),
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}
