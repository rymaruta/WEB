"use client";

import { useActionState } from "react";
import type { ActionState } from "../../actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** 速報の見出しを直してから投稿する。見出しは投稿文とカードの両方に使う（1〜2行、各12字まで） */
export function BreakingForm({ action, headline, kind = "速報" }: { action: Action; headline: string[]; kind?: "速報" | "注目のニュース" }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form
      action={run}
      className="space-y-2"
      onSubmit={(e) => {
        const text = String(new FormData(e.currentTarget).get("headline") ?? "").replace(/\n/g, "");
        if (!window.confirm(`「${text}」を${kind}として X に投稿します。よろしいですか？（取り消しはできません）`)) e.preventDefault();
      }}
    >
      <label className="block text-sm font-bold">
        見出し（1〜2行、各12字まで。カードでは改行の位置で折り返します）
        <textarea name="headline" rows={2} defaultValue={headline.join("\n")} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base" />
      </label>
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-accent bg-accent px-3 py-2 text-sm font-bold text-accent-fg disabled:opacity-50">
        {pending ? "…" : `${kind}として X に投稿する`}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm font-bold whitespace-pre-line text-accent">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-bold whitespace-pre-line text-emerald-700 dark:text-emerald-400">
          {state.ok}
        </p>
      )}
    </form>
  );
}
