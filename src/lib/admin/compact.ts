/**
 * 解析待ちの一覧の応答を短くする（?compact=1）。定期実行は同じ一覧を何度も取り直すため、
 * 2回目以降は執筆ルール（instructions）と出力形式（outputSchema）を省き、読み込む量（トークン）を減らす。
 * 一段下（stories / followups など）の同名の項目も省く
 */
const HEAVY = new Set(["instructions", "outputSchema"]);

export function compactPending<T extends Record<string, unknown>>(request: Request, body: T): T {
  if (new URL(request.url).searchParams.get("compact") !== "1") return body;
  const strip = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([k]) => !HEAVY.has(k)));
  return Object.fromEntries(
    Object.entries(strip(body)).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? strip(v as Record<string, unknown>) : v]),
  ) as T;
}
