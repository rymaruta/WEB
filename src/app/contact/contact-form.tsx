"use client";

import { useActionState } from "react";
import { sendContact } from "./actions";
import { CONTACT_KINDS } from "./kinds";

const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base";

export function ContactForm() {
  const [state, run, pending] = useActionState(sendContact, undefined);
  if (state?.ok) {
    return (
      <p role="status" className="rounded-lg bg-surface-muted p-4 font-bold">
        {state.ok}
      </p>
    );
  }
  return (
    <form action={run} className="space-y-4">
      <label className="block text-sm font-bold">
        お問い合わせの種類（必須）
        <select name="kind" required defaultValue="" className={field}>
          <option value="" disabled>
            選んでください
          </option>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-bold">
        お名前（任意）
        <input name="name" maxLength={60} autoComplete="name" className={field} />
      </label>
      <label className="block text-sm font-bold">
        返信先のメールアドレス（必須）
        <input name="email" type="email" required maxLength={120} autoComplete="email" className={field} />
      </label>
      <label className="block text-sm font-bold">
        お問い合わせの内容（必須）
        <textarea name="body" required minLength={10} maxLength={4000} rows={7} className={field} />
      </label>
      {/* ロボット対策（人には見えない欄） */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-accent bg-accent px-5 py-2 font-bold text-accent-fg disabled:opacity-50">
        {pending ? "送信中…" : "送信する"}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm font-bold text-accent">
          {state.error}
        </p>
      )}
    </form>
  );
}
