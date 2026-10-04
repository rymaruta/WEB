import { prisma } from "@/lib/db";
import { diffSchedule, recordScheduleChanges } from "@/lib/schedule-changes";

/**
 * 公式ストアの発売予定を取り込む（毎日1回）。記事から拾う発売日だけでは、話題になった作品しか載らないため、
 * 任天堂（My Nintendo Store のソフト検索）・PlayStation Store（予約受付中）・Steam（人気の近日登場）の公式の発売予定日で補う。
 * 取り込むのは作品名・発売日・機種・発売元・ストアのページだけ。数百円の小品などは載せない。
 */

export type Listing = { source: "nintendo" | "playstation" | "steam"; externalId: string; title: string; release: string; platforms: string[]; maker: string | null; url: string };

const UA = "Mozilla/5.0 (compatible; ZenbuNaviBot/1.0; +https://zenbu-navi.com/about)";

/** 作品名を比べるための形（記号・空白・機種名の付け足しを除く） */
export function titleKey(title: string): string {
  return title
    .replace(/[™®©]/g, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s*(for\s+)?nintendo\s+switch(\s*2)?(\s+edition)?\s*$/i, "")
    .replace(/[\s・:：\-－–—_.,、。!！?？'"“”‘’「」『』()（）\[\]【】/／~〜]+/g, "");
}

// ---- 任天堂 ----

/** 作品として載せる形態（ダウンロード版・パッケージ版。追加コンテンツは載せない） */
const NINTENDO_FORMS = new Set(["HAC_DL", "HAC_DOWNLOADABLE", "HAC_CARD", "BEE_DL", "BEE_DOWNLOADABLE", "BEE_CARD"]);
const NINTENDO_HARD: Record<string, string> = { "1_HAC": "Switch", "05_BEE": "Switch 2" };
/** 価格が安くても載せる発売元 */
const MAJOR_MAKERS =
  /任天堂|ポケモン|スクウェア・エニックス|カプコン|バンダイナムコ|セガ|アトラス|コーエーテクモ|KONAMI|コナミ|レベルファイブ|日本一ソフトウェア|スパイク・チュンソフト|マーベラス|アークシステムワークス|SNK|ユービーアイ|Ubisoft|エレクトロニック・アーツ|Electronic Arts|2K|WB Games|ワーナー|Activision|アクティビジョン|ベセスダ|Bethesda|マイクロソフト|ハムスター|ディースリー|フリュー|イマジニア|タイトー|ガンホー|サンリオ|ハドソン|HAL研究所|インティ・クリエイツ|テクモ/;
/** これより安いものは、主な発売元のもの以外は載せない（小品が並ばないように） */
const MIN_PRICE = 2500;

type NintendoItem = { nsuid: string | null; id: string; title: string; sdate: string | null; hard: string; sform: string; maker: string | null; price: number | null; current_price?: number | null };

/** "2026.10.8" → "2026-10-08"（日付でなければ null） */
export function nintendoDate(sdate: string | null): string | null {
  const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(sdate?.trim() ?? "");
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

export function pickNintendo(items: NintendoItem[]): Listing[] {
  const groups = new Map<string, Listing>();
  for (const it of items) {
    if (!NINTENDO_FORMS.has(it.sform) || !NINTENDO_HARD[it.hard]) continue;
    const release = nintendoDate(it.sdate);
    if (!release) continue;
    const price = it.price ?? it.current_price ?? 0;
    if (price < MIN_PRICE && !MAJOR_MAKERS.test(it.maker ?? "")) continue;
    const title = it.title.trim();
    // Switch 版と Switch 2 版、ダウンロード版とパッケージ版は1件にまとめる
    const key = `${titleKey(title)}|${release}`;
    const nsuid = it.nsuid ?? it.id;
    const prev = groups.get(key);
    const platform = NINTENDO_HARD[it.hard];
    if (prev) {
      if (!prev.platforms.includes(platform)) prev.platforms.push(platform);
      continue;
    }
    groups.set(key, {
      source: "nintendo",
      externalId: nsuid,
      title,
      release,
      platforms: [platform],
      maker: it.maker?.trim() || null,
      url: `https://store-jp.nintendo.com/item/software/D${nsuid}`,
    });
  }
  // 機種の並びは新しい機種から
  return [...groups.values()].map((l) => ({ ...l, platforms: l.platforms.sort((a, b) => b.localeCompare(a)) }));
}

async function fetchNintendo(): Promise<Listing[]> {
  const items: NintendoItem[] = [];
  // 予約受付中と、発売前（予約前）の作品
  for (const situ of ["preorder", "unreleased"]) {
    const url = `https://search.nintendo.jp/nintendo_soft/search.json?opt_sshow=1&fq=${encodeURIComponent(`ssitu_s:${situ}`)}&limit=300&page=1&sort=${encodeURIComponent("sodate asc")}`;
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`nintendo ${situ}: HTTP ${res.status}`);
    const json = (await res.json()) as { result?: { items?: NintendoItem[] } };
    items.push(...(json.result?.items ?? []));
  }
  return pickNintendo(items);
}

// ---- PlayStation ----

/** PlayStation Store の「予約受付中」のカテゴリ */
const PS_CATEGORY = "3bf499d7-7acf-4931-97dd-2667494ee2c9";
/** PlayStation Store のカテゴリの一覧を返す問い合わせ（ストアのページが使っているもの） */
const PS_GRID_QUERY = "4ce7d410a4db2c8b635a48c1dcec375906ff63b19dadd87e073f8fd0c0481d35";
const PS_PAGE = 24;

type PsProduct = { id: string; name: string; npTitleId: string; storeDisplayClassification: string; platforms: string[] };

/** エディション違い（デラックス版など）を1件にまとめる。同じタイトル ID のうち、本編（FULL_GAME）か一番短い名前を使う。追加コンテンツは載せない */
export function pickPlayStation(products: PsProduct[]): PsProduct[] {
  const byTitle = new Map<string, PsProduct>();
  const rank = (p: PsProduct) => (p.storeDisplayClassification === "FULL_GAME" ? 0 : 1);
  for (const p of products) {
    if (p.storeDisplayClassification === "ADD_ON_PACK") continue;
    const prev = byTitle.get(p.npTitleId);
    if (!prev || rank(p) < rank(prev) || (rank(p) === rank(prev) && p.name.length < prev.name.length)) byTitle.set(p.npTitleId, p);
  }
  return [...byTitle.values()];
}

/** 作品名から、機種や通常版の付け足しを除く（「PS4 & PS5」「スタンダードエディション」など） */
export function psTitle(name: string): string {
  return name
    .replace(/\s*PS4\s*&\s*PS5\s*$/i, "")
    .replace(/\s*(スタンダード\s*エディション|スタンダード版|通常版|Standard Edition)\s*$/i, "")
    .replace(/^『(.+)』$/, "$1")
    .trim();
}

/** 作品ページに書かれた発売日（UTC）を、日本の日付 YYYY-MM-DD にする */
export function psReleaseDate(html: string): string | null {
  const m = /"releaseDate":"(\d{4}-\d{2}-\d{2}T[\d:.]+Z)"/.exec(html);
  if (!m) return null;
  return new Date(new Date(m[1]).getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

async function fetchPlayStation(): Promise<Listing[]> {
  const products: PsProduct[] = [];
  for (let offset = 0; offset < 300; offset += PS_PAGE) {
    const params = new URLSearchParams({
      operationName: "categoryGridRetrieve",
      variables: JSON.stringify({ id: PS_CATEGORY, pageArgs: { size: PS_PAGE, offset } }),
      extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: PS_GRID_QUERY } }),
    });
    const res = await fetch(`https://web.np.playstation.com/api/graphql/v1/op?${params}`, {
      headers: { "user-agent": UA, "content-type": "application/json", "x-psn-store-locale-override": "ja-JP" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`playstation: HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { categoryGridRetrieve?: { products?: PsProduct[]; pageInfo?: { isLast?: boolean } } } };
    const grid = json.data?.categoryGridRetrieve;
    if (!grid) throw new Error("playstation: no data");
    products.push(...(grid.products ?? []));
    if (grid.pageInfo?.isLast !== false) break;
  }
  const out: Listing[] = [];
  // 発売日は一覧にないため、作品ごとのページから読む（1日1回、1件ずつ間をあけて）
  for (const p of pickPlayStation(products)) {
    const url = `https://store.playstation.com/ja-jp/product/${p.id}`;
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
      const release = res.ok ? psReleaseDate(await res.text()) : null;
      if (release) out.push({ source: "playstation", externalId: p.npTitleId, title: psTitle(p.name), release, platforms: p.platforms.filter((x) => /^PS[45]$/.test(x)).sort().reverse(), maker: null, url });
    } catch {
      // 1件読めなくても、ほかの作品は取り込む
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return out;
}

// ---- Steam ----

/** Steam の人気の近日登場から載せる件数（人気順の上位だけ） */
const STEAM_TAKE = 10;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** "2026年10月5日" → "2026-10-05"、"2026年10月" → "2026-10"。それ以外（「近日登場」「第4四半期」など）は null */
export function steamDate(text: string): string | null {
  const t = text.normalize("NFKC").trim();
  const d = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(t);
  if (d) return `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}`;
  const m = /^(\d{4})年(\d{1,2})月$/.exec(t);
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : null;
}

export function parseSteamResults(html: string): Listing[] {
  const out: Listing[] = [];
  const re = /data-ds-appid="(\d+)"[\s\S]*?<span class="title">([\s\S]*?)<\/span>[\s\S]*?class="search_released[^"]*">\s*([\s\S]*?)\s*<\/div>/g;
  for (const m of html.matchAll(re)) {
    const release = steamDate(m[3]);
    if (!release) continue;
    out.push({
      source: "steam",
      externalId: m[1],
      title: decode(m[2]).trim(),
      release,
      platforms: ["PC"],
      maker: null,
      url: `https://store.steampowered.com/app/${m[1]}/`,
    });
  }
  return out;
}

async function fetchSteam(): Promise<Listing[]> {
  const url = `https://store.steampowered.com/search/results/?filter=popularcomingsoon&cc=JP&l=japanese&count=${STEAM_TAKE}&infinite=1`;
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`steam: HTTP ${res.status}`);
  const json = (await res.json()) as { results_html?: string };
  return parseSteamResults(json.results_html ?? "").slice(0, STEAM_TAKE);
}

// ---- 取り込み ----

/** 予定の変更の記録に残す情報源（ストアの発売予定の一覧） */
const STORE_URLS: Record<string, string> = {
  nintendo: "https://www.nintendo.com/jp/schedule/",
  playstation: "https://store.playstation.com/ja-jp/pages/latest",
  steam: "https://store.steampowered.com/search/?filter=popularcomingsoon",
};

/**
 * 公式ストアから取り込み、DB を最新にする。ストアから消えた発売前の作品（発売中止・延期で日付未定など）は消す。
 * 取得に失敗したストアは、前回の内容をそのまま残す
 */
export async function syncGameListings(now = new Date()) {
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const result: Record<string, { fetched: number; removed: number } | { error: string }> = {};
  for (const [source, fetcher] of [
    ["nintendo", fetchNintendo],
    ["playstation", fetchPlayStation],
    ["steam", fetchSteam],
  ] as const) {
    try {
      const listings = await fetcher();
      if (listings.length === 0) throw new Error("empty");
      // 取り込む前のこれからの予定と比べて、発売日の変更を記録する（ストアの ID で見分ける）。
      // ストアの一覧は件数に上限がある（人気順の上位など）ため、一覧から外れたことは中止・延期の印にならない。日付が変わったものだけを残す
      const before = await prisma.gameListing.findMany({ where: { source, release: { gte: today.slice(0, 7) } }, select: { externalId: true, title: true, release: true } });
      await recordScheduleChanges(
        "game",
        diffSchedule(
          before.map((g) => ({ key: g.externalId, title: g.title, date: g.release })),
          listings.map((l) => ({ key: l.externalId, title: l.title, date: l.release })),
          today,
        ).filter((d) => d.newDate !== null),
        STORE_URLS[source],
        now,
      );
      for (const l of listings) {
        const data = { title: l.title, release: l.release, platforms: l.platforms, maker: l.maker, url: l.url, checkedAt: now };
        await prisma.gameListing.upsert({
          where: { source_externalId: { source, externalId: l.externalId } },
          create: { source, externalId: l.externalId, ...data },
          update: data,
        });
      }
      const { count } = await prisma.gameListing.deleteMany({
        where: { source, externalId: { notIn: listings.map((l) => l.externalId) }, release: { gte: today.slice(0, 7) } },
      });
      result[source] = { fetched: listings.length, removed: count };
    } catch (e) {
      result[source] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return result;
}
