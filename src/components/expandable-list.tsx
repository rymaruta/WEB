"use client";

import { useState } from "react";

/** 一度に見せる件数（それ以上は「すべて見る」で開く） */
const VISIBLE = 5;

/** 最初は VISIBLE 件だけを見せ、残りは「すべて見る」で開く */
export function Expandable<T>({ items, render, keyOf }: { items: T[]; render: (item: T) => React.ReactNode; keyOf: (item: T) => string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, VISIBLE);
  return (
    <>
      <ul className="divide-y divide-border">
        {shown.map((item) => (
          <li key={keyOf(item)}>{render(item)}</li>
        ))}
      </ul>
      {items.length > VISIBLE && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-xs font-bold text-accent hover:underline" aria-expanded={open}>
          {open ? "閉じる" : `すべて見る（${items.length}本）`}
        </button>
      )}
    </>
  );
}
