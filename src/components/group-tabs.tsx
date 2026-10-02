"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readSaved(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // 保存できない環境では、いつも最初のタブを出す
    return null;
  }
}

export type TabGroup = { key: string; label: string; note?: string; content: ReactNode };

/**
 * まとまりをタブで切り替えて、1つずつ見せる（すべてを縦に並べると長くなるため）。
 * 選んだタブはその人の端末に覚えておく。どのまとまりのリンクもページには入れておき、隠すだけにする（検索エンジンにも辿れるように）
 */
export function GroupTabs({ id, groups, label, initial }: { id: string; groups: TabGroup[]; label: string; /** 最初に開くタブ（覚えたタブより優先） */ initial?: string }) {
  const key = `zn:tab:${id}`;
  const base = useId();
  // 前に選んだタブ（端末に保存したもの）。サーバーでの表示と最初の描画では使わない
  const saved = useSyncExternalStore(subscribeStorage, () => readSaved(key), () => null);
  const [chosen, setChosen] = useState<string | null>(null);
  const valid = (k: string | null | undefined) => (k && groups.some((g) => g.key === k) ? k : null);
  const active = valid(chosen) ?? valid(initial) ?? valid(saved) ?? groups[0]?.key;
  const choose = (k: string) => {
    setChosen(k);
    try {
      localStorage.setItem(key, k);
    } catch {}
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        {groups.map((g) => {
          const selected = g.key === active;
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              id={`${base}-tab-${g.key}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${g.key}`}
              onClick={() => choose(g.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold ${selected ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-muted hover:text-fg"}`}
            >
              {g.label}
              {g.note && <span className={`ml-1 font-normal ${selected ? "opacity-80" : "text-fg-subtle"}`}>{g.note}</span>}
            </button>
          );
        })}
      </div>
      {groups.map((g) => (
        <div key={g.key} role="tabpanel" id={`${base}-panel-${g.key}`} aria-labelledby={`${base}-tab-${g.key}`} hidden={g.key !== active} className="pt-2">
          {g.content}
        </div>
      ))}
    </div>
  );
}
