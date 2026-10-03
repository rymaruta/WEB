import type { Prisma } from "@/generated/prisma/client";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { extractNames } from "@/lib/stories/verify";
import { keyTerms } from "@/lib/topics/merge-check";
import type { Photo } from "./photo-data";

/**
 * 話題の写真。媒体の画像は利用規約で使えないため（src/lib/rights.ts）、自由利用ライセンスの写真だけを使う。
 * 人物: 見出しの人名を日本語版ウィキペディアで引き、Wikidata で「人間」であることを確かめ、Wikidata の画像（Commons）を使う。
 * 作者・ライセンスを記録して表示する（CC BY・CC BY-SA の表示義務のため）。
 */

// HTTP のヘッダーには ASCII しか書けない（サイト名の日本語を入れると送信前に失敗する）
const UA = { "User-Agent": `ZenbuNavi/1.0 (${siteConfig.url}/about)` };
/** 表示してよいライセンス（帰属表示で使えるもの） */
const FREE_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)? [1-4]\.0|CC BY(-SA)? 2\.[15])/i;
/** 人の写真を出さない話題（事件・事故・訃報・私生活のトラブル。写真が当事者の印象を左右するため） */
const SENSITIVE = /逮捕|容疑|被告|被害|事件|事故|死亡|死去|訃報|急死|遺体|殺|自殺|性的|暴行|不倫|離婚|不祥事|書類送検|起訴|判決|謝罪|炎上|ハラスメント/;
/** 1回の処理で外部に問い合わせる名前の上限（Wikimedia に負荷をかけない） */
const LOOKUP_BUDGET = 60;
const CHECK_WINDOW_HOURS = 72;

/** JSON を取る。ページがない（404）は null。それ以外の失敗は例外にし、「写真なし」と記録せずに次の回で探し直す */
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** 人名から、自由利用ライセンスの人物写真を探す。人物と確かめられない・写真がない場合は null */
export async function lookupPersonPhoto(name: string): Promise<Photo | null> {
  const summary = (await getJson(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`)) as {
    type?: string;
    title?: string;
    wikibase_item?: string;
  } | null;
  // 曖昧さ回避のページや、別の名前のページ（転送で別人・別の物に行く場合）は使わない
  if (!summary || summary.type !== "standard" || !summary.wikibase_item) return null;
  if (summary.title?.replace(/\s*\(.*\)$/, "").replace(/\s/g, "") !== name.replace(/\s/g, "")) return null;
  const qid = summary.wikibase_item;
  const entity = (await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)) as {
    entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }>;
  };
  const claims = entity?.entities?.[qid]?.claims ?? {};
  const isHuman = (claims.P31 ?? []).some((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id === "Q5");
  const file = claims.P18?.[0]?.mainsnak?.datavalue?.value;
  if (!isHuman || typeof file !== "string") return null;
  const info = (await getJson(
    `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: "query",
      format: "json",
      titles: `File:${file}`,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "500",
    })}`,
  )) as null | { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }> } };
  const ii = Object.values(info?.query?.pages ?? {})[0]?.imageinfo?.[0];
  const license = ii?.extmetadata?.LicenseShortName?.value ?? "";
  if (!ii?.thumburl || !ii.descriptionurl || !FREE_LICENSE.test(license)) return null;
  const artist = stripTags(ii.extmetadata?.Artist?.value ?? "").slice(0, 40) || "不明";
  // 計測用の引数（utm_*）は付けない
  return { url: ii.thumburl.split("?")[0], page: ii.descriptionurl, credit: `${artist} / ${license}` };
}

/** 見出しから、写真を探す名前の候補（事件などの話題は探さない）。人物かどうかは Wikidata で確かめる */
export function photoNames(title: string): string[] {
  if (SENSITIVE.test(title)) return [];
  const terms = [...extractNames(title), ...keyTerms(title)].filter((n) => n.length >= 3 && n.length <= 10 && !/^[a-z0-9]+$/.test(n));
  return [...new Set(terms)].slice(0, 3);
}

/** 最近の話題に人物写真を付ける（スケジューラーが定期的に呼ぶ）。名前ごとの結果は EntityPhoto に残す */
export async function resolveTopicPhotos(limit = 150, now = new Date()) {
  const topics = await prisma.topic.findMany({
    where: { photoCheckedAt: null, mergedIntoId: null, lastSeenAt: { gte: new Date(now.getTime() - CHECK_WINDOW_HOURS * 3_600_000) } },
    orderBy: { score: "desc" },
    take: limit,
    select: { id: true, title: true, aiTitle: true },
  });
  let budget = LOOKUP_BUDGET;
  let found = 0;
  let checked = 0;
  for (const t of topics) {
    const names = photoNames(t.aiTitle || t.title);
    let photo: Photo | null = null;
    let pending = false;
    for (const name of names) {
      const cached = await prisma.entityPhoto.findUnique({ where: { name } });
      if (cached) {
        if (cached.url && cached.page && cached.credit) photo = { url: cached.url, page: cached.page, credit: cached.credit };
      } else if (budget > 0) {
        budget--;
        const p = await lookupPersonPhoto(name).catch(() => undefined);
        // 通信の失敗（undefined）は記録せず、次の回にもう一度探す
        if (p === undefined) {
          pending = true;
          continue;
        }
        await prisma.entityPhoto.upsert({ where: { name }, create: { name, ...(p ?? {}) }, update: { ...(p ?? { url: null, page: null, credit: null }), checkedAt: now } });
        photo = p;
      } else {
        pending = true;
      }
      if (photo) break;
    }
    // 調べきれなかった名前が残る話題は、次の回に回す
    if (!photo && pending) continue;
    await prisma.topic.update({
      where: { id: t.id },
      data: { photo: (photo ?? undefined) as Prisma.InputJsonValue | undefined, photoCheckedAt: now },
    });
    checked++;
    if (photo) found++;
  }
  return { candidates: topics.length, checked, found, lookups: LOOKUP_BUDGET - budget };
}

/** 企業発表（PR TIMES）の代表画像。報道目的の利用が規約で認められている（src/lib/rights.ts）。RSS に画像がないため発表ページから読む */
const PRESS_IMAGE_BUDGET = 20;

/** 発表ページの og:image を、一覧の表示に合う大きさの画像の URL にする（PR TIMES の配信網が大きさを変えて返す） */
export function pressImageUrl(html: string): string | null {
  const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  if (!m) return null;
  const url = m[1].replace(/&amp;/g, "&");
  if (!/^https:\/\/prcdn\.freetls\.fastly\.net\/release_image\//.test(url)) return null;
  return `${url.split("?")[0]}?format=jpeg&auto=webp&fit=bounds&width=800&height=450`;
}

/** 最近の企業発表の記事に代表画像を付ける。画像がない発表は空文字を入れ、読み直さない */
export async function fillPressImages(now = new Date()) {
  const articles = await prisma.article.findMany({
    where: { imageUrl: null, publisher: "PR TIMES", publishedAt: { gte: new Date(now.getTime() - CHECK_WINDOW_HOURS * 3_600_000) }, topicId: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: PRESS_IMAGE_BUDGET,
    select: { id: true, url: true },
  });
  let found = 0;
  for (const a of articles) {
    const res = await fetch(a.url, { headers: UA, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res || (!res.ok && res.status !== 404)) continue;
    const image = res.ok ? pressImageUrl(await res.text()) : null;
    await prisma.article.update({ where: { id: a.id }, data: { imageUrl: image ?? "" } });
    if (image) found++;
  }
  return { checked: articles.length, found };
}
