"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-bold" htmlFor="password">
        パスワード
      </label>
      <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-base" />
      {state?.error && (
        <p role="alert" className="text-sm font-bold text-accent">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-accent px-4 py-3 font-bold text-accent-fg disabled:opacity-60">
        {pending ? "確認中…" : "ログイン"}
      </button>
    </form>
  );
}
