"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { previousReadAt } from "@/lib/read-topics";

/**
 * 前回この話題を読んだときから増えた動きを知らせる。読んだ日時は端末にだけ保存している（src/lib/read-topics.ts）。
 * 同じ枠の中の data-update-at（ISO の日時）を持つ項目のうち、前回より後のものに data-new を付ける（見た目は CSS で変える）
 */
export function SinceRead({ topicId, containerId, times }: { topicId: number; containerId: string; times: string[] }) {
  const [state, setState] = useState<{ at: number; count: number } | null>(null);

  useEffect(() => {
    const at = previousReadAt(topicId);
    if (at === null) return;
    const count = times.filter((t) => Date.parse(t) > at).length;
    document.querySelectorAll<HTMLElement>(`#${containerId} [data-update-at]`).forEach((el) => {
      if (Date.parse(el.dataset.updateAt ?? "") > at) el.dataset.new = "true";
    });
    // 端末の記録を読んでから表示を決めるため、描画の後に状態を変える
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ at, count });
  }, [topicId, containerId, times]);

  if (!state) return null;
  return (
    <p className="mb-3 rounded-lg bg-accent-soft/60 px-3 py-2 text-sm" role="status">
      前回お読みになった {formatDateTime(new Date(state.at))} 以降の動きは
      <strong className="mx-0.5 font-black text-accent">{state.count}件</strong>
      {state.count > 0 ? "です（「前回より後」の印）。" : "ありません。"}
    </p>
  );
}
