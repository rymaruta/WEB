"use client";

import { useState, useSyncExternalStore } from "react";

/** 押したかどうかはこの端末にだけ残す（同じ記事で何度も数えないため） */
const key = (id: number) => `zn:fb:${id}`;
const noop = () => () => {};

function sentBefore(id: number): string | null {
  try {
    return localStorage.getItem(key(id));
  } catch {
    return null;
  }
}

/** まとめ記事の評価ボタン。件数だけを送り、記事の書き方を直す手がかりにする */
export function FeedbackButtons({ topicId }: { topicId: number }) {
  const stored = useSyncExternalStore(noop, () => sentBefore(topicId), () => null);
  const [sent, setSent] = useState<string | null>(null);
  const done = sent ?? stored;

  function send(kind: "helpful" | "unclear") {
    setSent(kind);
    try {
      localStorage.setItem(key(topicId), kind);
    } catch {}
    fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topicId, kind }),
      keepalive: true,
    }).catch(() => {});
  }

  if (done) {
    return <p className="text-xs text-fg-muted">ご意見ありがとうございます。記事づくりの参考にします。</p>;
  }
  const button = "rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-fg hover:bg-surface-muted";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fg-muted">この記事は</span>
      <button type="button" className={button} onClick={() => send("helpful")}>
        役に立った
      </button>
      <button type="button" className={button} onClick={() => send("unclear")}>
        分かりにくい
      </button>
    </div>
  );
}
