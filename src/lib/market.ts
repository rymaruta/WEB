/**
 * 経済のページの市況（ドル円・長期金利）。出典を明記すれば自由に使える公的な数字だけを使う。
 * - ドル円：日本銀行 時系列統計データ（東京市場 ドル・円 スポット 17時時点）
 * - 長期金利：財務省 国債金利情報（10年）
 * 日経平均は、日経の資料に無断転載の禁止が明記されているため載せない。
 * どちらも1日1回ほどしか変わらないため、サーバーの中に30分覚えておく。取得に失敗したら、その数字だけ出さない。
 */

export type MarketPoint = { value: number; prev: number | null; date: string };
export type MarketSnapshot = { usdjpy: MarketPoint | null; jgb10: MarketPoint | null };

const TTL_MS = 30 * 60_000;
let cached: { at: number; data: MarketSnapshot } | null = null;

/** 日本銀行の日次の値（null を除く）から、最新とその前の値 */
export function parseBojSeries(json: unknown, code: string): MarketPoint | null {
  const rows = (json as { RESULTSET?: { SERIES_CODE: string; VALUES: { SURVEY_DATES: number[]; VALUES: (number | null)[] } }[] }).RESULTSET ?? [];
  const r = rows.find((x) => x.SERIES_CODE === code);
  if (!r) return null;
  const points = r.VALUES.SURVEY_DATES.map((d, i) => ({ d: String(d), v: r.VALUES.VALUES[i] })).filter((p): p is { d: string; v: number } => typeof p.v === "number");
  const last = points.at(-1);
  if (!last) return null;
  const date = `${last.d.slice(0, 4)}-${last.d.slice(4, 6)}-${last.d.slice(6, 8)}`;
  return { value: last.v, prev: points.at(-2)?.v ?? null, date };
}

/** 和暦の日付（R8.10.1）を YYYY-MM-DD に */
function warekiDate(s: string): string | null {
  const m = /^R(\d+)\.(\d{1,2})\.(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  return `${2018 + Number(m[1])}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** 財務省の国債金利の表（CSV）から、10年の最新とその前の値 */
export function parseJgbCsv(csv: string): MarketPoint | null {
  const lines = csv.split(/\r?\n/);
  const header = lines.find((l) => l.startsWith("基準日"));
  if (!header) return null;
  const col = header.split(",").indexOf("10年");
  if (col < 0) return null;
  const rows = lines
    .map((l) => l.split(","))
    .map((c) => ({ date: warekiDate(c[0] ?? ""), v: Number(c[col]) }))
    .filter((r): r is { date: string; v: number } => !!r.date && Number.isFinite(r.v) && r.v !== 0);
  const last = rows.at(-1);
  if (!last) return null;
  return { value: last.v, prev: rows.at(-2)?.v ?? null, date: last.date };
}

async function fetchText(url: string, encoding = "utf-8"): Promise<string> {
  // ページは一定時間ごとに作り直す（ISR）ため、毎回取りに行く指定（no-store）にすると作り直しが失敗する。30分ごとに取り直す
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), next: { revalidate: 1800 } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new TextDecoder(encoding).decode(await res.arrayBuffer());
}

async function loadUsdJpy(): Promise<MarketPoint | null> {
  const now = new Date(Date.now() + 9 * 3_600_000);
  const from = new Date(now.getTime() - 40 * 86_400_000);
  const start = `${from.getUTCFullYear()}${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  const json = JSON.parse(await fetchText(`https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=jp&db=FM08&code=FXERD04&startDate=${start}`));
  return parseBojSeries(json, "FXERD04");
}

async function loadJgb10(): Promise<MarketPoint | null> {
  // 今月の表。月初めで1日分しかないときは、前の日と比べるために過去分の表も読む
  const month = parseJgbCsv(await fetchText("https://www.mof.go.jp/jgbs/reference/interest_rate/jgbcm.csv", "shift_jis"));
  if (month && month.prev !== null) return month;
  const all = parseJgbCsv(await fetchText("https://www.mof.go.jp/jgbs/reference/interest_rate/data/jgbcm_all.csv", "shift_jis"));
  if (!month) return all;
  if (!all) return month;
  // 過去分の表は今月分より更新が遅いことがあるため、今月の値をその前の日の値と比べる
  return all.date < month.date ? { ...month, prev: all.value } : all;
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.data;
  const [usdjpy, jgb10] = await Promise.all([loadUsdJpy().catch(() => null), loadJgb10().catch(() => null)]);
  const data = { usdjpy, jgb10 };
  // 両方とも取れなかったときは覚えず、次の表示でもう一度試す
  if (usdjpy || jgb10) cached = { at: Date.now(), data };
  return data;
}
