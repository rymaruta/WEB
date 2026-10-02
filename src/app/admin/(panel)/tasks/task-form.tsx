"use client";

import { useActionState } from "react";
import type { ActionState } from "../../actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** 「AI に頼む」の入力欄 */
export function TaskForm({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-2">
      <textarea
        name="prompt"
        rows={4}
        required
        maxLength={4000}
        placeholder="例：今日いちばん読まれた記事を3つ調べて、見出しを教えて"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"
      />
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-bold text-accent-fg disabled:opacity-50">
        {pending ? "…" : "AI に頼む"}
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
