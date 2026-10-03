"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "../../actions";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

/** 入力が止まってからカードを描き直すまでの待ち時間（打つたびに画像を作らないように） */
const PREVIEW_DELAY_MS = 600;

/**
 * 速報・注目のニュースの見出しを直してから投稿する。見出しは投稿文とカードの両方に使う（1〜2行、各12字まで）。
 * previewSrc を渡すと、入力中の見出しで描いたカードを下に出す（投稿されるカードと同じ見た目を確かめられる）。
 * headlineOnly は要点のない出来事（AI 解析前）。見出しだけのカードになり、全部で48字まで大きく折り返して見せる
 */
export function BreakingForm({
  action,
  headline,
  kind = "速報",
  previewSrc,
  headlineOnly = false,
}: {
  action: Action;
  headline: string[];
  kind?: "速報" | "注目のニュース";
  previewSrc?: string;
  headlineOnly?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [text, setText] = useState(headline.join("\n"));
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const t = setTimeout(() => setShown(text), PREVIEW_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]);
  const src = previewSrc ? `${previewSrc}${previewSrc.includes("?") ? "&" : "?"}headline=${encodeURIComponent(shown)}` : null;
  return (
    <form
      action={run}
      className="space-y-2"
      onSubmit={(e) => {
        const value = String(new FormData(e.currentTarget).get("headline") ?? "").replace(/\n/g, "");
        if (!window.confirm(`「${value}」を${kind}として X に投稿します。よろしいですか？（取り消しはできません）`)) e.preventDefault();
      }}
    >
      <label className="block text-sm font-bold">
        {headlineOnly ? "見出し（要点のない出来事なので、見出しだけのカードになります。全部で48字まで、大きな字で折り返します）" : "見出し（1〜2行、各12字まで。カードでは改行の位置で折り返します）"}
        <textarea
          name="headline"
          rows={headlineOnly ? 3 : 2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base"
        />
      </label>
      {src && (
        <div>
          <p className="text-xs text-fg-muted">投稿されるカード（見出しを直すと描き直します）</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- 管理画面のプレビュー（その場で作る画像） */}
          <img src={src} alt={`${kind}のカードのプレビュー`} className="mt-1 w-full max-w-sm rounded-lg border border-border" />
        </div>
      )}
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
