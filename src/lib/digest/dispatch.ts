import { prisma } from "@/lib/db";
import { countNewDueTopics } from "@/lib/ai/store";
import { logEvent } from "@/lib/events";
import { fireRoutine, routineReady, ROUTINES, type RoutineName } from "./routine";

/**
 * 仕事がたまったときだけ、Claude Code の定期実行をサーバーから起動する（無料。決まった時刻を待たず、空振りもしない）。
 * - まとめ記事: 書くべき話題が一定数たまったら
 * - ダイジェスト用の解析: 解析待ちの出来事が一定数たまったら
 * 一度起動したら、作業が終わるまで（最短の間隔）は起動しない。深夜は起動しない（朝にまとめて処理する）
 */
export const DISPATCH_RULES: Record<Exclude<RoutineName, "breaking" | "tasks">, { minPending: number; minIntervalMinutes: number; staleMinutes: number }> = {
  // 5件たまったら起動。1件でも2時間たてば起動する
  articles: { minPending: 5, minIntervalMinutes: 50, staleMinutes: 120 },
  digest: { minPending: 5, minIntervalMinutes: 50, staleMinutes: 120 },
};

/** 起動しない時間帯（日本時間 1時〜6時） */
const QUIET = { from: 1, until: 6 };

export const FIRE_SCOPE = "routine.fire";

/** 起動するか（純粋な判断。テスト用） */
export function shouldFire(rule: { minPending: number; minIntervalMinutes: number; staleMinutes: number }, pending: number, minutesSinceLast: number | null, jstHour: number): boolean {
  if (pending === 0) return false;
  if (jstHour >= QUIET.from && jstHour < QUIET.until) return false;
  const since = minutesSinceLast ?? Infinity;
  if (since < rule.minIntervalMinutes) return false;
  return pending >= rule.minPending || since >= rule.staleMinutes;
}

const jstHour = (d: Date) => (d.getUTCHours() + 9) % 24;

async function pendingOf(name: keyof typeof DISPATCH_RULES) {
  if (name === "articles") return countNewDueTopics();
  return prisma.story.count({ where: { status: { in: ["QUEUED", "DELTA_QUEUED"] } } });
}

/** 5分ごとに呼ぶ。トークンが入っている定期実行だけを対象にする */
export async function dispatchRoutines(now = new Date()) {
  const results: Record<string, string> = {};
  for (const name of Object.keys(DISPATCH_RULES) as (keyof typeof DISPATCH_RULES)[]) {
    if (!routineReady(name)) {
      results[name] = "no-token";
      continue;
    }
    const [pending, last] = await Promise.all([
      pendingOf(name),
      prisma.eventLog.findFirst({ where: { scope: FIRE_SCOPE, ref: name }, orderBy: { at: "desc" }, select: { at: true } }),
    ]);
    const since = last ? (now.getTime() - last.at.getTime()) / 60_000 : null;
    if (!shouldFire(DISPATCH_RULES[name], pending, since, jstHour(now))) {
      results[name] = `wait (${pending})`;
      continue;
    }
    try {
      const { sessionUrl } = await fireRoutine(name);
      await logEvent("info", FIRE_SCOPE, `${ROUTINES[name].label}を起動（待ち ${pending} 件）`, name, { sessionUrl });
      results[name] = "fired";
    } catch (e) {
      await logEvent("error", "routine.fire-failed", `${ROUTINES[name].label}を起動できませんでした`, name, String(e));
      results[name] = "failed";
    }
  }
  return results;
}
