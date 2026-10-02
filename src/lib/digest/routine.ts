/**
 * Claude Code の定期実行（Routines）を、サーバーから今すぐ起動する。API の料金はかからない（Claude のプランの範囲）。
 * 起動用のトークンは claude.ai/code/routines の各定期実行の「API」トリガーで発行し、Parameter Store に置く。
 * 仕様: https://code.claude.com/docs/en/routines.md#add-an-api-trigger （試験提供中。beta ヘッダーが変わることがある）
 */

const BETA = "experimental-cc-routine-2026-04-01";

/** 起動できる定期実行。id は claude.ai の定期実行の ID、tokenEnv は起動用トークンの環境変数 */
export const ROUTINES = {
  /** 速報用AI解析（大きな話題だけ） */
  breaking: { id: "trig_01EEfSthMk69oDZDrdNx5KxE", tokenEnv: "ROUTINE_FIRE_TOKEN", label: "速報用AI解析" },
  /** まとめ記事作成（記事・発売日・値上げ・アニメ・YouTube・ジャンルの見直し） */
  articles: { id: "trig_01Kheeh9gjfuQtsKrXiELhnm", tokenEnv: "ROUTINE_TOKEN_ARTICLES", label: "まとめ記事作成" },
  /** ダイジェスト用AI解析（定時配信の候補） */
  digest: { id: "trig_01AWThNpgQHFCU1MmVM5a1vL", tokenEnv: "ROUTINE_TOKEN_DIGEST", label: "ダイジェスト用AI解析" },
} as const;

export type RoutineName = keyof typeof ROUTINES;

const tokenOf = (name: RoutineName, env: Record<string, string | undefined>) => env[ROUTINES[name].tokenEnv] ?? "";

/** トークンが入っているか（Parameter Store の仮の値「ここにトークンを貼る」などは未設定として扱う） */
export function routineReady(name: RoutineName, env: Record<string, string | undefined> = process.env): boolean {
  const token = tokenOf(name, env);
  return token.length >= 20 && /^[\x21-\x7e]+$/.test(token);
}

export const routineFireReady = (env: Record<string, string | undefined> = process.env) => routineReady("breaking", env);

/** 定期実行を起動する。text は定期実行に渡す依頼の印（定期実行の指示で、指示としては扱わないよう決めている） */
export async function fireRoutine(name: RoutineName, text?: string, env: Record<string, string | undefined> = process.env) {
  if (!routineReady(name, env)) throw new Error(`起動用のトークンが未設定です（${ROUTINES[name].tokenEnv}）`);
  const res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${ROUTINES[name].id}/fire`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenOf(name, env)}`,
      "anthropic-beta": BETA,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(text ? { text } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`定期実行を起動できませんでした（${res.status}）: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json().catch(() => ({}))) as { claude_code_session_url?: string };
  return { sessionUrl: body.claude_code_session_url ?? null };
}

/** 速報の確認を頼む（「AI に確認させて投稿」） */
export function fireBreakingRoutine(payload: { storyId: string; topicId: number; title: string }, env: Record<string, string | undefined> = process.env) {
  return fireRoutine("breaking", JSON.stringify({ request: "breaking-check", ...payload }), env);
}
