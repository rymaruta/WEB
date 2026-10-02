"use client";

import { useActionState } from "react";
import type { ActionState } from "../../actions";

/** 「AI に確認させて投稿」。AI（無料の定期実行）が数分で確かめ、問題なければ自動で投稿する */
export function AiRequestForm({ action }: { action: () => Promise<ActionState> }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-1">
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-accent px-3 py-2 text-sm font-bold text-accent disabled:opacity-50">
        {pending ? "…" : "AI に確認させて投稿"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm font-bold text-accent">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
          {state.ok}
        </p>
      )}
    </form>
  );
}
