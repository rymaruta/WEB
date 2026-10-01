import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** 障害の追跡用の記録。管理画面の Logs で見る。記録の失敗で本来の処理を止めない */
export async function logEvent(level: "info" | "warn" | "error", scope: string, message: string, ref?: string, data?: unknown) {
  const line = JSON.stringify({ event: scope, level, message, ref, data });
  if (level === "error") console.error(line);
  else console.log(line);
  try {
    await prisma.eventLog.create({ data: { level, scope, message, ref, data: data === undefined ? undefined : (data as Prisma.InputJsonValue) } });
  } catch {
    // DB に書けなくても標準出力には残る
  }
}
