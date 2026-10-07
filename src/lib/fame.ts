import { siteConfig } from "@/config/site";
import { extractNames } from "@/lib/stories/verify";
import { keyTerms } from "@/lib/topics/merge-check";

/**
 * 世間の知名度。速報は「誰もが知っている人・会社・作品の出来事」に絞る（運営者の方針。2026-10-04）。
 * 見出しの人名・固有名詞を日本語版ウィキペディアで引き、次のどちらかなら「よく知られている」とする。
 * - 日本語版の直近30日の閲覧数が FAME.minViews 以上（日本で関心が高い。例: 久保建英、福原遥）
 * - 記事のある言語版の数が FAME.minSitelinks 以上（世界で知られている。例: メッシ、エヌビディア）
 * 曖昧さ回避のページは使わない。転送（「メッシ」→「リオネル・メッシ」）は使う
 */
export const FAME = { minViews: 30_000, minSitelinks: 40, days: 30 } as const;

const UA = { "User-Agent": `ZenbuNavi/1.0 (${siteConfig.url}/about)` };
/** 同じ語を何度も問い合わせない（1日保持） */
const cache = new Map<string, { at: number; fame: Fame | null }>();
const TTL = 24 * 3_600_000;

export type Fame = { term: string; title: string; views: number; sitelinks: number; /** 人・会社や作品などか。地名や一般的な言葉（「女性」「中国」「犯罪」）は false */ subject: boolean };

type Claims = Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>;

/**
 * Wikidata の記述から、速報の主役になりうるもの（人・会社・団体・チーム・作品）かを判定する。
 * 2026-10-07: 「女性」「中国」「山形県」「那覇市」「犯罪」のような一般的な言葉・地名まで「よく知られている」と判定し、
 * 雑誌のコラムや調査の発表が速報の候補になっていた。
 * - 人（P31 が Q5）
 * - 設立日（P571）・発表日（P577）・本社（P159）・所属リーグ（P118）・業種（P452）・上場先（P414）のどれかがあり、位置の座標（P625）がない
 *   （国・都道府県・市町村などの地名は座標を持つ。「女性」「犯罪」のような概念はこれらを持たない）
 */
export function isSubjectEntity(claims: Claims | undefined): boolean {
  if (!claims) return false;
  const p31 = (claims.P31 ?? []).map((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id);
  if (p31.includes("Q5")) return true;
  if (claims.P625?.length) return false;
  return ["P571", "P577", "P159", "P118", "P452", "P414"].some((p) => (claims[p]?.length ?? 0) > 0);
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** 見出しから、知名度を調べる語の候補（人名と固有名詞。短すぎる語・数字だけの語は除く） */
export function fameTerms(title: string): string[] {
  const terms = [...extractNames(title), ...keyTerms(title)].map((t) => t.normalize("NFKC")).filter((t) => t.length >= 2 && t.length <= 20 && !/^\d+$/.test(t));
  return [...new Set(terms)].slice(0, 6);
}

export const isFamous = (f: Pick<Fame, "views" | "sitelinks">) => f.views >= FAME.minViews || f.sitelinks >= FAME.minSitelinks;

/** 語ごとの知名度を調べる（ウィキペディア1回・Wikidata 1回の問い合わせ）。記事がない語は null */
export async function lookupFame(terms: string[], fetchImpl: Fetch = fetch, now = Date.now()): Promise<Map<string, Fame | null>> {
  const out = new Map<string, Fame | null>();
  const todo = terms.filter((t) => {
    const c = cache.get(t);
    if (c && now - c.at < TTL) {
      out.set(t, c.fame);
      return false;
    }
    return true;
  });
  if (todo.length === 0) return out;

  const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", redirects: "1", titles: todo.join("|"), prop: "pageprops|pageviews", ppprop: "wikibase_item|disambiguation", pvipdays: String(FAME.days) });
  const res = await fetchImpl(`https://ja.wikipedia.org/w/api.php?${qs}`, { headers: UA, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  const data = (await res.json()) as {
    query?: {
      normalized?: { from: string; to: string }[];
      redirects?: { from: string; to: string }[];
      pages?: { title: string; missing?: boolean; pageprops?: { wikibase_item?: string; disambiguation?: string }; pageviews?: Record<string, number | null> }[];
    };
  };
  const q = data.query ?? {};
  const follow = (t: string) => {
    let x = q.normalized?.find((n) => n.from === t)?.to ?? t;
    x = q.redirects?.find((r) => r.from === x)?.to ?? x;
    return x;
  };
  const pages = new Map((q.pages ?? []).map((p) => [p.title, p]));
  const qids = [...new Set([...pages.values()].map((p) => p.pageprops?.wikibase_item).filter((x): x is string => !!x))];
  const sitelinks = new Map<string, number>();
  const subjects = new Set<string>();
  if (qids.length) {
    const wd = await fetchImpl(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: "wbgetentities", format: "json", ids: qids.join("|"), props: "sitelinks|claims" })}`, { headers: UA, signal: AbortSignal.timeout(10_000) });
    if (wd.ok) {
      const j = (await wd.json()) as { entities?: Record<string, { sitelinks?: Record<string, unknown>; claims?: Claims }> };
      for (const [id, e] of Object.entries(j.entities ?? {})) {
        sitelinks.set(id, Object.keys(e.sitelinks ?? {}).filter((k) => k.endsWith("wiki")).length);
        if (isSubjectEntity(e.claims)) subjects.add(id);
      }
    }
  }
  for (const t of todo) {
    const p = pages.get(follow(t));
    let fame: Fame | null = null;
    if (p && !p.missing && p.pageprops && p.pageprops.disambiguation === undefined) {
      const views = Object.values(p.pageviews ?? {}).reduce<number>((a, b) => a + (b ?? 0), 0);
      const qid = p.pageprops.wikibase_item ?? "";
      fame = { term: t, title: p.title, views, sitelinks: sitelinks.get(qid) ?? 0, subject: subjects.has(qid) };
    }
    cache.set(t, { at: now, fame });
    out.set(t, fame);
  }
  return out;
}

/** 見出しに、よく知られた人・会社・作品が出てくるか（いちばん知られているもの）。調べられなかったときは null */
export async function famousSubject(title: string, fetchImpl: Fetch = fetch, now = Date.now()): Promise<Fame | null> {
  const terms = fameTerms(title);
  if (terms.length === 0) return null;
  // 地名・一般的な言葉は、閲覧数が多くても主役として数えない
  const found = [...(await lookupFame(terms, fetchImpl, now)).values()].filter((f): f is Fame => !!f && f.subject && isFamous(f));
  return found.sort((a, b) => b.views - a.views || b.sitelinks - a.sitelinks)[0] ?? null;
}

/** テスト用 */
export const clearFameCache = () => cache.clear();
