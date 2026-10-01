import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import {
  BLUESKY_MAX_GRAPHEMES,
  BLUESKY_MAX_IMAGE_BYTES,
  blueskyCredentialsFromEnv,
  createPost as createBlueskyPost,
  createSession,
  graphemes,
  uploadBlob,
} from "@/lib/social/bluesky";
import { refreshThreadsToken, threadsConfigured } from "@/lib/social/threads";
import { digestPath } from "./archive";
import { CARD_SIZE, renderCard } from "./cards";
import { altText, POST_CTA } from "./compose";
import { loadForPublish } from "./publish";
import type { Slot } from "./slots";

/**
 * X に投稿した回を、Bluesky にも投稿する（同時投稿）。本文は X と同じで、画像への案内の代わりに記事へのリンクを付ける。
 * Threads は利用者の傾向が違うため使い回さず、1日1本の別の投稿にする（threads-daily.ts）。
 * - X の投稿が終わった直後に呼ぶ。X の結果には影響させない（失敗しても X の回は「投稿済み」のまま）
 * - 失敗したら、定期処理（/api/cron/crosspost）が投稿から1時間以内に限って再試行する（合計3回まで）
 * - 3回失敗したら運営者にメールで知らせる
 * - 認証情報が設定されていない配信先は使わない
 */

export const CROSSPOST_CHANNELS = ["BLUESKY"] as const;
export type CrossChannel = (typeof CROSSPOST_CHANNELS)[number];
export const CROSSPOST_RULES = {
  maxAttempts: 3,
  /** X に投稿してからこの時間を過ぎた回は再試行しない（古い話題を後から流さない） */
  retryWithinMinutes: 60,
  /** 投稿中のまま、この時間を過ぎたものは中断したとみなす */
  staleMinutes: 15,
} as const;

const NAMES: Record<CrossChannel, string> = { BLUESKY: "Bluesky" };

export function enabledChannels(env: Record<string, string | undefined> = process.env): CrossChannel[] {
  return CROSSPOST_CHANNELS.filter(() => Boolean(blueskyCredentialsFromEnv(env)));
}

/**
 * X の本文を、他の配信先向けに直す。画像への案内（「画像をスワイプで詳しく👉」）をサイトへのリンクに替える。
 * 文字数の上限を超えるときは、見出しの行を後ろから減らし、それでも超えるならリンクを外す。
 */
export function crossPostText(xText: string, link: string, max: number, count: (s: string) => number): string {
  const lines = xText.split("\n").filter((l) => l !== POST_CTA);
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const withLink = () => [...lines, "", "詳しくはこちら", link].join("\n");
  while (count(withLink()) > max) {
    const last = lines.findLastIndex((l) => l.startsWith("・"));
    if (last < 0 || lines.filter((l) => l.startsWith("・")).length <= 1) break;
    lines.splice(last, 1);
  }
  if (count(withLink()) <= max) return withLink();
  return [...lines].join("\n").slice(0, max);
}

/** この回のページ（速報は話題のページ） */
async function editionLink(editionId: string): Promise<string> {
  const e = await prisma.edition.findUniqueOrThrow({
    where: { id: editionId },
    select: { slot: true, date: true, items: { orderBy: { position: "asc" }, take: 1, select: { story: { select: { topicId: true } } } } },
  });
  const path = e.slot === "BREAKING" ? `/topic/${e.items[0]?.story.topicId}` : digestPath(e.date, e.slot as Slot);
  return `${siteConfig.url}${path}`;
}

/** Bluesky の画像の上限（1MB）を超えるときは JPEG にする */
async function fitImage(png: ArrayBuffer): Promise<{ data: Uint8Array; mime: string }> {
  if (png.byteLength <= BLUESKY_MAX_IMAGE_BYTES * 0.95) return { data: new Uint8Array(png), mime: "image/png" };
  const sharp = (await import("sharp")).default;
  return { data: new Uint8Array(await sharp(Buffer.from(png)).jpeg({ quality: 85 }).toBuffer()), mime: "image/jpeg" };
}

const running = new Set<string>();

/** 1つの配信先に投稿する。投稿した・不要だった・失敗した、を返す（例外は投げない） */
export async function crossPostEdition(editionId: string, channel: CrossChannel, now = new Date()) {
  const key = `${editionId}:${channel}`;
  if (running.has(key)) return "running" as const;
  running.add(key);
  try {
    return await crossPost(editionId, channel, now);
  } finally {
    running.delete(key);
  }
}

async function crossPost(editionId: string, channel: CrossChannel, now: Date) {
  const loaded = await loadForPublish(editionId);
  if (!loaded || loaded.edition.status !== "PUBLISHED" || loaded.plan.length === 0) return "skipped" as const;
  const { edition, cards } = loaded;
  // 1回の配信は1投稿で完結する（splitParts）。念のため最初の投稿だけを使う
  const part = loaded.plan[0];

  const existing = await prisma.publication.findUnique({ where: { editionId_channel: { editionId, channel } } });
  if (existing?.status === "PUBLISHED") return "already-published" as const;
  if (existing && existing.attempts >= CROSSPOST_RULES.maxAttempts) return "gave-up" as const;
  if (existing?.status === "PUBLISHING" && now.getTime() - existing.updatedAt.getTime() < CROSSPOST_RULES.staleMinutes * 60_000) {
    return "running" as const;
  }

  const link = await editionLink(editionId);
  const text = crossPostText(part.text, link, BLUESKY_MAX_GRAPHEMES, graphemes);
  const altTexts = part.cards.map((n) => (cards[n] ? altText(cards[n]) : ""));

  const pub = await prisma.publication.upsert({
    where: { editionId_channel: { editionId, channel } },
    create: {
      editionId,
      channel,
      status: "PUBLISHING",
      attempts: 1,
      parts: { create: [{ position: 0, text, cards: part.cards, altTexts, mediaIds: [] }] },
    },
    update: { status: "PUBLISHING", lastError: null, attempts: { increment: 1 } },
  });

  try {
    const creds = blueskyCredentialsFromEnv();
    if (!creds) throw new Error("Bluesky の認証情報が設定されていません");
    const session = await createSession(creds);
    const images = [];
    for (const [i, n] of part.cards.slice(0, 4).entries()) {
      const { data, mime } = await fitImage(await (await renderCard(cards[n])).arrayBuffer());
      images.push({ blob: await uploadBlob(session, data, mime), alt: altTexts[i] ?? "", width: CARD_SIZE, height: CARD_SIZE });
    }
    const externalId = await createBlueskyPost(session, text, images, now);
    await prisma.$transaction([
      prisma.publicationPart.update({
        where: { publicationId_position: { publicationId: pub.id, position: 0 } },
        data: { externalId, status: "PUBLISHED", publishedAt: new Date(), lastError: null },
      }),
      prisma.publication.update({ where: { id: pub.id }, data: { status: "PUBLISHED", publishedAt: new Date(), lastError: null } }),
    ]);
    await logEvent("info", "crosspost", `${edition.key}: ${NAMES[channel]}に投稿しました`, editionId, { channel, externalId });
    return "published" as const;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "FAILED", lastError: message } });
    await logEvent("error", "crosspost", `${edition.key}: ${NAMES[channel]}への投稿に失敗（${pub.attempts}回目）`, editionId, { channel, message });
    if (pub.attempts >= CROSSPOST_RULES.maxAttempts) {
      await notifyOwner({
        title: `${NAMES[channel]}への投稿に失敗しました`,
        what: `X に投稿した回（${edition.key}）を${NAMES[channel]}にも投稿しようとしましたが、${CROSSPOST_RULES.maxAttempts}回とも失敗しました。X の投稿には影響ありません。`,
        action: `続くようであれば、${NAMES[channel]}の認証情報（アプリパスワード）が有効か確認してください。`,
        detail: message.slice(0, 300),
      });
    }
    return "failed" as const;
  }
}

/** X の投稿の直後に呼ぶ。設定済みのすべての配信先に投稿する */
export async function crossPostAll(editionId: string) {
  const results: Partial<Record<CrossChannel, string>> = {};
  for (const channel of enabledChannels()) {
    results[channel] = await crossPostEdition(editionId, channel).catch((e) => `error: ${e instanceof Error ? e.message : e}`);
  }
  return results;
}

/** 定期処理。Threads のトークンを延長し、直近に X へ投稿した回のうち、Bluesky に出ていないものを投稿する */
export async function runCrossPostCatchUp(now = new Date()) {
  const channels = enabledChannels();
  const token = threadsConfigured() ? await refreshThreadsToken(now) : "not-configured";
  if (channels.length === 0) return { token, editions: 0, results: [] };
  const editions = await prisma.edition.findMany({
    where: { status: "PUBLISHED", publishedAt: { gte: new Date(now.getTime() - CROSSPOST_RULES.retryWithinMinutes * 60_000) } },
    select: { id: true, key: true, publications: { select: { channel: true, status: true, attempts: true } } },
  });
  const results = [];
  for (const e of editions) {
    for (const channel of channels) {
      const p = e.publications.find((x) => x.channel === channel);
      if (p && (p.status === "PUBLISHED" || p.attempts >= CROSSPOST_RULES.maxAttempts)) continue;
      results.push({ edition: e.key, channel, result: await crossPostEdition(e.id, channel, now) });
    }
  }
  return { token, editions: editions.length, results };
}
