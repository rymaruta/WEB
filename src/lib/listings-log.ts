import { logEvent } from "@/lib/events";

/** 結果の中に、取り込みに失敗した配信元（{ error }）があるか */
export function failedSources(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  return Object.entries(result as Record<string, unknown>)
    .filter(([, v]) => v && typeof v === "object" && "error" in (v as object))
    .map(([k, v]) => `${k}: ${String((v as { error: unknown }).error).slice(0, 80)}`);
}

/**
 * 発売・公開・放送予定の取り込みの結果を記録する（管理画面の「ログ」と /api/admin/logs で確かめる）。
 * 配信元ごとの失敗は取り込み処理の中で握りつぶされ、これまで記録に残らなかった
 */
export async function logListings(scope: string, result: unknown, error?: unknown) {
  const failed = error ? [`全体: ${error instanceof Error ? error.message : String(error)}`] : failedSources(result);
  await logEvent(failed.length ? "warn" : "info", scope, failed.length ? `取り込みに失敗: ${failed.join(" / ")}` : `取り込みました: ${JSON.stringify(result).slice(0, 300)}`).catch(
    () => null,
  );
}
