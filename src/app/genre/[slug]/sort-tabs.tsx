"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/**
 * 話題順・新着順の切り替え。両方の1ページ目を最初に読み込んでおき、押したら画面の中で切り替える（通信を待たない）。
 * 選んだ並び順は URL の #latest で持つ（ボタンと一覧が別の場所にあるため、共有の状態にする。共有・戻るボタンにも効く）
 */
type Sort = "trending" | "latest";
const EVENT = "zn:sort";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener(EVENT, cb);
  };
};
const current = (): Sort => (location.hash === "#latest" ? "latest" : "trending");
const onServer = (): Sort => "trending";

function select(s: Sort) {
  history.replaceState(null, "", s === "latest" ? "#latest" : location.pathname + location.search);
  window.dispatchEvent(new Event(EVENT));
}

export function SortButtons() {
  const sort = useSyncExternalStore(subscribe, current, onServer);
  const tab = (value: Sort, label: string) => (
    <button
      type="button"
      onClick={() => select(value)}
      aria-pressed={sort === value}
      className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${sort === value ? "bg-white text-black" : "text-white/85 hover:text-white"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-1 rounded-full bg-black/15 p-1" role="group" aria-label="並び順">
      {tab("trending", "話題順")}
      {tab("latest", "新着順")}
    </div>
  );
}

export function SortPanels({ trending, latest }: { trending: ReactNode; latest: ReactNode }) {
  const sort = useSyncExternalStore(subscribe, current, onServer);
  return (
    <>
      <div hidden={sort !== "trending"}>{trending}</div>
      <div hidden={sort !== "latest"}>{latest}</div>
    </>
  );
}
