import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { createPost, credentialsFromEnv, PRICES, setAltText, uploadImage, XApiError } from "@/lib/x/client";
import { getEditionView, loadEntries } from "./build";
import { renderCard } from "./cards";
import { altText, buildBreakingCard, buildCards, replyText, splitParts, type Card } from "./compose";

/**
 * 承認済みの配信回を X に投稿する。本投稿 → 自分へのリプライ の順に送る。
 * 冪等: 送ったパートは externalId を保存し、再実行のときは飛ばす（同じ内容を二度投稿しない）。
 */

export class PublishError extends Error {}

/** 同じ配信回を同時に投稿しない（サーバー 1 台の前提） */
const running = new Set<string>();

export async function publishEdition(editionId: string) {
  if (running.has(editionId)) throw new PublishError("この配信回は投稿中です");
  running.add(editionId);
  try {
    return await publish(editionId);
  } finally {
    running.delete(editionId);
  }
}

type Plan = { position: number; cards: number[]; text: string }[];

/** 投稿するカードと、投稿の分け方。速報は1枚のカードを1件で投稿する */
async function loadForPublish(editionId: string): Promise<{ edition: { key: string; status: string }; cards: Card[]; plan: Plan } | null> {
  const row = await prisma.edition.findUnique({
    where: { id: editionId },
    include: { items: { orderBy: { position: "asc" }, select: { position: true, role: true, storyId: true, override: true } } },
  });
  if (!row) return null;
  if (row.slot === "BREAKING") {
    const [entry] = await loadEntries(row.items);
    if (!entry) return { edition: row, cards: [], plan: [] };
    return { edition: row, cards: [buildBreakingCard(entry, row.scheduledAt, null)], plan: [{ position: 0, cards: [0], text: row.postText.join("\n") }] };
  }
  const found = await getEditionView(editionId);
  if (!found) return null;
  const { edition, view } = found;
  const plan = splitParts(view.entries.length).map((nos, i) => ({
    position: i,
    cards: nos,
    text: i === 0 ? edition.postText.join("\n") : replyText(view.entries, nos),
  }));
  return { edition, cards: view.entries.length ? buildCards(view) : [], plan: view.entries.length ? plan : [] };
}

async function publish(editionId: string) {
  const creds = credentialsFromEnv();
  if (!creds) throw new PublishError("X の認証情報が設定されていません");
  const loaded = await loadForPublish(editionId);
  if (!loaded) throw new PublishError("配信回が見つかりません");
  const { edition, cards, plan } = loaded;
  if (edition.status === "PUBLISHED") return { status: "already-published" as const };
  // FAILED は途中で失敗した回の再実行（送ったパートは飛ばす）
  if (edition.status !== "APPROVED" && edition.status !== "FAILED") throw new PublishError("承認済みの配信回だけを投稿できます");
  if (plan.length === 0) throw new PublishError("載せるニュースがありません");

  const pub = await prisma.publication.upsert({
    where: { editionId_channel: { editionId, channel: "X" } },
    create: {
      editionId,
      channel: "X",
      status: "PUBLISHING",
      parts: { create: plan.map((p) => ({ position: p.position, text: p.text, cards: p.cards, altTexts: p.cards.map((n) => altText(cards[n])), mediaIds: [] })) },
    },
    update: { status: "PUBLISHING", lastError: null },
    include: { parts: { orderBy: { position: "asc" } } },
  });

  let cost = Number(pub.costUsd ?? 0);
  let previousId: string | undefined;
  try {
    for (const part of pub.parts) {
      if (part.externalId) {
        previousId = part.externalId;
        continue;
      }
      const mediaIds: string[] = [];
      for (const [i, n] of part.cards.entries()) {
        const png = await (await renderCard(cards[n])).arrayBuffer();
        const id = await uploadImage(creds, png);
        await setAltText(creds, id, part.altTexts[i] ?? "");
        cost += PRICES.mediaMetadata;
        mediaIds.push(id);
      }
      const postId = await createPost(creds, part.text, mediaIds, previousId);
      cost += PRICES.post;
      await prisma.publicationPart.update({
        where: { publicationId_position: { publicationId: pub.id, position: part.position } },
        data: { externalId: postId, mediaIds, status: "PUBLISHED", publishedAt: new Date(), lastError: null },
      });
      previousId = postId;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.publication.update({ where: { id: pub.id }, data: { status: "FAILED", lastError: message, costUsd: cost } });
    await prisma.edition.update({ where: { id: editionId }, data: { status: "FAILED" } });
    await logEvent("error", "x.publish", `${edition.key}: 投稿に失敗`, editionId, { message, retryAfter: e instanceof XApiError ? e.retryAfterSec : null });
    throw new PublishError(`投稿に失敗しました。途中まで送った分は、再実行しても重複しません。\n${message}`);
  }

  const now = new Date();
  const items = await prisma.editionItem.findMany({ where: { editionId }, select: { storyId: true, story: { select: { eventThreadId: true } } } });
  const threads = items.map((i) => i.story.eventThreadId).filter((t): t is string => !!t);
  await prisma.$transaction([
    prisma.publication.update({ where: { id: pub.id }, data: { status: "PUBLISHED", publishedAt: now, costUsd: cost } }),
    prisma.edition.update({ where: { id: editionId }, data: { status: "PUBLISHED", publishedAt: now } }),
    prisma.story.updateMany({ where: { id: { in: items.map((i) => i.storyId) }, status: { not: "PUBLISHED" } }, data: { status: "PUBLISHED", publishedAt: now } }),
    prisma.eventThread.updateMany({ where: { id: { in: threads } }, data: { lastPublishedAt: now } }),
  ]);
  await logEvent("info", "x.publish", `${edition.key}: 投稿しました`, editionId, { posts: pub.parts.length, costUsd: cost });
  return { status: "published" as const, firstPostId: (await prisma.publicationPart.findFirst({ where: { publicationId: pub.id, position: 0 } }))?.externalId ?? null };
}
