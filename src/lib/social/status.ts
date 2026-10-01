import { prisma } from "@/lib/db";
import { THREADS_DAILY, type ThreadsDailyRecord } from "@/lib/digest/threads-daily";
import { credentialsFromEnv } from "@/lib/x/client";
import { blueskyCredentialsFromEnv } from "./bluesky";
import { threadsConfigured, threadsTokenInfo } from "./threads";

/** 管理画面の「配信先」に出す、配信先ごとの状態 */
export async function getChannelStatus(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [xLast, bskyLast, bskyFailed, threadsDaily, threadsFailed, token] = await Promise.all([
    prisma.publication.findFirst({ where: { channel: "X", status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { publishedAt: true } }),
    prisma.publication.findFirst({ where: { channel: "BLUESKY", status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { publishedAt: true } }),
    prisma.publication.findFirst({
      where: { channel: "BLUESKY", status: "FAILED", updatedAt: { gte: dayAgo } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, lastError: true, attempts: true, edition: { select: { id: true, key: true } } },
    }),
    prisma.setting.findUnique({ where: { key: THREADS_DAILY.settingKey } }),
    prisma.eventLog.findFirst({
      where: { scope: "threads.daily", level: "error", at: { gte: dayAgo } },
      orderBy: { at: "desc" },
      select: { at: true, data: true },
    }),
    threadsTokenInfo(),
  ]);
  const daily = (threadsDaily?.value as ThreadsDailyRecord | undefined) ?? null;
  return {
    x: { configured: Boolean(credentialsFromEnv()), lastPublishedAt: xLast?.publishedAt ?? null },
    bluesky: {
      configured: Boolean(blueskyCredentialsFromEnv()),
      handle: blueskyCredentialsFromEnv()?.handle ?? null,
      lastPublishedAt: bskyLast?.publishedAt ?? null,
      failure: bskyFailed
        ? { at: bskyFailed.updatedAt, error: bskyFailed.lastError, attempts: bskyFailed.attempts, editionId: bskyFailed.edition.id, editionKey: bskyFailed.edition.key }
        : null,
    },
    threads: {
      configured: threadsConfigured(),
      at: THREADS_DAILY.at,
      daily,
      failure: threadsFailed && (!daily?.at || Date.parse(daily.at) < threadsFailed.at.getTime())
        ? { at: threadsFailed.at, error: String((threadsFailed.data as { message?: string } | null)?.message ?? "") }
        : null,
      token,
      tokenDaysLeft: token?.expiresAt ? Math.floor((token.expiresAt.getTime() - now.getTime()) / 86_400_000) : null,
    },
  };
}
