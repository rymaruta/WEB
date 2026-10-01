"use client";

import { useActionState } from "react";
import type { ActionState } from "../../../actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state?.error) return <p role="alert" className="mt-2 whitespace-pre-line text-sm font-bold text-accent">{state.error}</p>;
  if (state?.ok) return <p role="status" className="mt-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">{state.ok}</p>;
  return null;
}

/** ボタン 1 つで動く操作（並べ替え・削除・確認・追加・承認） */
export function ActionButton({ action, label, tone = "plain", confirm }: { action: Action; label: string; tone?: "plain" | "primary" | "danger"; confirm?: string }) {
  const [state, run, pending] = useActionState(action, undefined);
  const cls =
    tone === "primary"
      ? "bg-accent text-accent-fg border-accent"
      : tone === "danger"
        ? "border-border text-accent hover:border-accent"
        : "border-border hover:border-accent";
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <button type="submit" disabled={pending} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50 ${cls}`}>
        {pending ? "…" : label}
      </button>
      <Message state={state} />
    </form>
  );
}

const field = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base";

/** 1 本の編集。見出しと要点は 1 行ずつ */
export function EditForm({
  action,
  initial,
}: {
  action: Action;
  initial: { headline: string; shortTitle: string; keyword: string; points: string; why: string };
}) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="mt-3 space-y-2 text-sm">
      <label className="block font-bold">
        見出し（1〜2行、各12字まで）
        <textarea name="headline" rows={2} defaultValue={initial.headline} className={field} />
      </label>
      <label className="block font-bold">
        一覧用の見出し（14字まで）
        <input name="shortTitle" defaultValue={initial.shortTitle} className={field} />
      </label>
      <label className="block font-bold">
        キーワード（8字まで）
        <input name="keyword" defaultValue={initial.keyword} className={field} />
      </label>
      <label className="block font-bold">
        要点（1行に1つ、2〜3個、各16字まで）
        <textarea name="points" rows={3} defaultValue={initial.points} className={field} />
      </label>
      <label className="block font-bold">
        なぜ重要（任意、26字まで）
        <input name="why" defaultValue={initial.why} className={field} />
      </label>
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-accent px-4 py-2 font-bold text-accent-fg disabled:opacity-50">
        {pending ? "保存中…" : "保存"}
      </button>
      <Message state={state} />
    </form>
  );
}

export function PostTextForm({ action, initial }: { action: Action; initial: string }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-2">
      <textarea name="postText" rows={2} defaultValue={initial} className={field} aria-label="投稿文（1行20字まで、2行まで）" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-bold hover:border-accent">
          保存
        </button>
        <button type="submit" name="restore" value="1" disabled={pending} className="min-h-11 rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg">
          自動の文に戻す
        </button>
      </div>
      <Message state={state} />
    </form>
  );
}
