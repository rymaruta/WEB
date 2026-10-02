import { prisma } from "@/lib/db";

/**
 * 公式ストアの発売予定を取り込む（毎日1回）。記事から拾う発売日だけでは、話題になった作品しか載らないため、
 * 任天堂（My Nintendo Store のソフト検索）と Steam（人気の近日登場）の公式の発売予定日で補う。
 * 取り込むのは作品名・発売日・機種・発売元・ストアのページだけ。数百円の小品などは載せない。
 */

export type Listing = { source: "nintendo" | "steam"; externalId: string; title: string; release: string; platforms: string[]; maker: string | null; url: string };

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

// ---- Steam ----

/** Steam の人気の近日登場から載せる件数（人気順の上位だけ） */
const STEAM_TAKE = 20;

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

/**
 * 公式ストアから取り込み、DB を最新にする。ストアから消えた発売前の作品（発売中止・延期で日付未定など）は消す。
 * 取得に失敗したストアは、前回の内容をそのまま残す
 */
export async function syncGameListings(now = new Date()) {
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const result: Record<string, { fetched: number; removed: number } | { error: string }> = {};
  for (const [source, fetcher] of [
    ["nintendo", fetchNintendo],
    ["steam", fetchSteam],
  ] as const) {
    try {
      const listings = await fetcher();
      if (listings.length === 0) throw new Error("empty");
      for (const l of listings) {
        const data = { title: l.title, release: l.release, platforms: l.platforms, maker: l.maker, url: l.url };
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
