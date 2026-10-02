/**
 * 速報用の解析（Claude Code の定期実行）を、今すぐ起動する。API の料金はかからない（Claude のプランの範囲）。
 * 起動用のトークン（ROUTINE_FIRE_TOKEN）は claude.ai/code/routines の「API」トリガーで発行し、Parameter Store に置く。
 * 仕様: https://code.claude.com/docs/en/routines.md#add-an-api-trigger （試験提供中。beta ヘッダーが変わることがある）
 */

/** 速報用AI解析（大きな話題だけ）の定期実行 */
const DEFAULT_URL = "https://api.anthropic.com/v1/claude_code/routines/trig_01EEfSthMk69oDZDrdNx5KxE/fire";
const BETA = "experimental-cc-routine-2026-04-01";

/** トークンが入っているか（Parameter Store の仮の値「ここにトークンを貼る」などは未設定として扱う） */
export function routineFireReady(env: Record<string, string | undefined> = process.env): boolean {
  const token = env.ROUTINE_FIRE_TOKEN ?? "";
  return token.length >= 20 && /^[\x21-\x7e]+$/.test(token);
}

/** 定期実行を起動し、確認してほしい出来事を渡す。起動できれば、起動した作業の URL を返す */
export async function fireBreakingRoutine(payload: { storyId: string; topicId: number; title: string }, env: Record<string, string | undefined> = process.env) {
  if (!routineFireReady(env)) throw new Error("起動用のトークンが未設定です");
  const res = await fetch(env.ROUTINE_FIRE_URL || DEFAULT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.ROUTINE_FIRE_TOKEN}`,
      "anthropic-beta": BETA,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: JSON.stringify({ request: "breaking-check", ...payload }) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`定期実行を起動できませんでした（${res.status}）: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json().catch(() => ({}))) as { claude_code_session_url?: string };
  return { sessionUrl: body.claude_code_session_url ?? null };
}
