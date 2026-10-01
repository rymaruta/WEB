import { createSign } from "node:crypto";

/**
 * Google Search Console の検索パフォーマンス（検索での表示回数・クリック・検索語）を読む。
 * サービスアカウント（Search Console で「制限付き」ユーザーとして追加したもの）の鍵で認証する。
 * 鍵は環境変数 GSC_SERVICE_ACCOUNT_JSON（Google Cloud でダウンロードした JSON そのもの）で渡す。
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com/webmasters/v3";
/** Search Console のデータは2日ほど遅れて確定する */
export const GSC_LAG_DAYS = 2;
/** 同じ集計を何度も問い合わせないよう、結果をこの時間だけ使い回す */
const CACHE_MS = 60 * 60_000;

type Credentials = { client_email: string; private_key: string };

export function gscConfigured(): boolean {
  return Boolean(readCredentials());
}

function readCredentials(): Credentials | null {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<Credentials>;
    return c.client_email && c.private_key ? { client_email: c.client_email, private_key: c.private_key } : null;
  } catch {
    return null;
  }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** サービスアカウントの署名付きトークン（JWT）を作る */
export function signJwt(c: Credentials, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: c.client_email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  return `${header}.${claim}.${b64url(signer.sign(c.private_key))}`;
}

let token: { value: string; expires: number } | null = null;

async function accessToken(c: Credentials): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signJwt(c) }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Google の認証に失敗しました（HTTP ${res.status}）`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function api<T>(c: Credentials, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${await accessToken(c)}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 403) throw new Error("Search Console に権限がありません。サービスアカウントをユーザーとして追加してください");
  if (!res.ok) throw new Error(`Search Console の取得に失敗しました（HTTP ${res.status}）`);
  return (await res.json()) as T;
}

/** このサービスアカウントが見られるプロパティのうち、サイトのもの（ドメインプロパティを優先） */
async function findSite(c: Credentials, host: string): Promise<string> {
  const { siteEntry = [] } = await api<{ siteEntry?: { siteUrl: string }[] }>(c, "/sites");
  const urls = siteEntry.map((s) => s.siteUrl);
  const site = urls.find((u) => u === `sc-domain:${host}`) ?? urls.find((u) => u.includes(host));
  if (!site) throw new Error("Search Console にこのサイトのプロパティが見つかりません。サービスアカウントを追加したか確認してください");
  return site;
}

type Row = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

export type GscReport = {
  start: string;
  end: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  daily: { date: string; clicks: number; impressions: number }[];
  queries: { query: string; clicks: number; impressions: number; position: number }[];
  pages: { path: string; clicks: number; impressions: number }[];
};

let cached: { key: string; at: number; report: GscReport } | null = null;

/** 確定済みの直近 days 日分（今日から GSC_LAG_DAYS 日前まで） */
export function reportRange(days: number, now = new Date()): { start: string; end: string } {
  const jst = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const end = new Date(now.getTime() - GSC_LAG_DAYS * 86_400_000);
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { start: jst(start), end: jst(end) };
}

/** 未設定なら null。取得に失敗したら例外（画面で理由を表示する） */
export async function getGscReport(siteUrl: string, days = 7): Promise<GscReport | null> {
  const c = readCredentials();
  if (!c) return null;
  const { start, end } = reportRange(days);
  const key = `${start}:${end}`;
  if (cached && cached.key === key && Date.now() - cached.at < CACHE_MS) return cached.report;

  const host = new URL(siteUrl).hostname;
  const site = encodeURIComponent(await findSite(c, host));
  const query = (dimensions: string[], rowLimit: number) =>
    api<{ rows?: Row[] }>(c, `/sites/${site}/searchAnalytics/query`, { startDate: start, endDate: end, dimensions, rowLimit }).then(
      (r) => r.rows ?? [],
    );
  const [totals, daily, queries, pages] = await Promise.all([query([], 1), query(["date"], days), query(["query"], 15), query(["page"], 10)]);

  const t = totals[0];
  const report: GscReport = {
    start,
    end,
    totals: { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? 0 },
    daily: daily.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
    queries: queries.map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position })),
    pages: pages.map((r) => {
      let path = r.keys[0];
      try {
        path = new URL(r.keys[0]).pathname;
      } catch {}
      return { path, clicks: r.clicks, impressions: r.impressions };
    }),
  };
  cached = { key, at: Date.now(), report };
  return report;
}
