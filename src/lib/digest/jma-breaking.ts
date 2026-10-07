import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { checkSingleHeadline } from "./check";
import { publishEdition } from "./publish";
import { editionKey, jstDate } from "./slots";

/**
 * 気象庁の防災情報（src/lib/jma.ts。収集で「気象庁」の記事として入る）から、直接速報を出す。
 * 大きな地震・津波警報・噴火速報は、気象庁の発表そのものが確かな一次情報なので、AI の解析や報道がそろうのを待たない
 * （2026-10-07。AI の定期処理が利用上限で止まっていても、災害の速報は出せるように）。
 * - 対象：最大震度5強以上の地震、大津波警報・津波警報の発表、噴火速報
 * - 気象庁が発表してから JMA_BREAKING.withinMinutes 分以内。深夜も出す。1日 JMA_BREAKING.maxPerDay 本まで（ふだんの速報の上限とは別）
 * - 同じ出来事（話題）の速報が今日すでにあれば出さない
 */
export const JMA_BREAKING = { withinMinutes: 30, maxPerDay: 3, approvedBy: "jma-breaking" } as const;

const SEVERE = /最大震度(5強|6弱|6強|7)の地震|(大津波警報|津波警報)を発表|噴火速報/;

/** 速報にする大きな出来事か（気象庁の記事の見出しで判断） */
export const isSevereJmaTitle = (title: string) => SEVERE.test(title);

/**
 * 速報のカードの見出し（1〜2行・各12字以内）。気象庁の記事の見出し（src/lib/jma.ts の buildJmaItem）から作る。
 * 例：「熊本県熊本地方で最大震度5強の地震（M6.1）」→ ["最大震度5強の地震", "熊本県熊本地方"]
 */
export function jmaHeadline(title: string): string[] {
  const quake = title.match(/^(?:(.+?)で)?最大震度(\S+?)の地震(?:（(M[\d.]+)）)?/);
  if (quake) {
    const [, area, intensity, mag] = quake;
    const first = `最大震度${intensity}の地震`;
    const second = [area, mag].filter(Boolean).join(" ");
    return second && second.length <= 12 ? [first, second] : area && area.length <= 12 ? [first, area] : [first];
  }
  const tsunami = title.match(/(大津波警報|津波警報)を発表/);
  if (tsunami) return [`${tsunami[1]}を発表`, "気象庁"];
  const eruption = title.match(/^(.+?)に噴火速報/);
  if (eruption) return eruption[1].length <= 12 ? [eruption[1], "噴火速報"] : ["噴火速報"];
  return [title.slice(0, 12)];
}

/** 速報の投稿文（出典の気象庁を明記する） */
export function jmaPostText(title: string, at: Date): string[] {
  const time = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return [`⚡ 速報（${time}時点・気象庁発表）`, "", title, "", "出典：気象庁ホームページ"];
}

/** 速報の確認のたびに呼ぶ。条件に合う気象庁の発表があれば、1本だけ投稿する */
export async function runJmaBreaking(now = new Date()) {
  const date = jstDate(now);
  const postedToday = await prisma.edition.count({ where: { slot: "BREAKING", date, approvedBy: JMA_BREAKING.approvedBy } });
  if (postedToday >= JMA_BREAKING.maxPerDay) return { result: "limit" as const };
  const articles = await prisma.article.findMany({
    where: { publisher: "気象庁", publishedAt: { gte: new Date(now.getTime() - JMA_BREAKING.withinMinutes * 60_000) }, topicId: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, title: true, summary: true, topicId: true },
  });
  for (const a of articles.filter((x) => isSevereJmaTitle(x.title))) {
    const topicId = a.topicId!;
    // 同じ出来事の速報が今日すでにあれば出さない（続報の電文で何度も出さない）
    const already = await prisma.edition.count({ where: { slot: "BREAKING", date, items: { some: { story: { topicId } } } } });
    if (already) continue;
    const headline = jmaHeadline(a.title);
    if (checkSingleHeadline(headline, false).length) continue;
    // 速報の回はストーリーに結びつける。まだなければ、気象庁の発表から作る（AI の解析は後から上書きされない別の回）
    const story =
      (await prisma.story.findFirst({ where: { topicId, kind: "NEW" }, orderBy: { revision: "asc" }, select: { id: true } })) ??
      (await prisma.story
        .create({
          data: {
            topicId,
            status: "PENDING",
            category: "SOCIETY",
            cardType: "BREAKING",
            riskFlags: ["DISASTER"],
            headline,
            summary: a.summary,
            confidence: 1,
            analyzedAt: now,
          },
          select: { id: true },
        })
        .catch(() => null));
    if (!story) continue;
    const edition = await prisma.edition
      .create({
        data: {
          key: editionKey(date, "BREAKING", story.id),
          slot: "BREAKING",
          date,
          status: "APPROVED",
          scheduledAt: now,
          deadlineAt: now,
          approvedAt: now,
          approvedBy: JMA_BREAKING.approvedBy,
          postText: jmaPostText(a.title, now),
          // 見出しだけを大きく見せるカード（要点は出さない）
          items: { create: [{ position: 1, storyId: story.id, role: "MAIN", override: { headline, layout: "headline" } }] },
        },
        select: { id: true },
      })
      .catch(() => null);
    if (!edition) continue;
    await logEvent("info", "breaking.jma", `気象庁の発表で速報: ${a.title}`, edition.id, { articleId: a.id, topicId });
    try {
      await publishEdition(edition.id);
      return { result: "published" as const, editionId: edition.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await notifyOwner({
        title: "災害の速報を投稿できませんでした",
        what: `気象庁の発表「${a.title}」の速報の投稿に失敗しました。`,
        action: "管理画面の「速報」で状況を確かめ、必要なら手動で投稿してください。",
        detail: message,
      });
      return { result: "failed" as const, editionId: edition.id, error: message };
    }
  }
  return { result: "none" as const };
}
