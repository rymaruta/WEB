import { Children, type ReactNode } from "react";

/**
 * スマホでは横にスライドして見る列、PC では縦に並べる。種類の違う特集の箱などを、縦に長く積まずに見せる。
 * 次の箱の端が見えるようにして、横に続くことを分かるようにする。1つしかなければそのまま出す
 */
export function Rail({ children, label }: { children: ReactNode; label: string }) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length <= 1) return <>{items}</>;
  return (
    <section aria-label={label}>
      <p className="mb-2 flex items-center justify-between text-xs font-bold text-fg-subtle sm:hidden">
        <span>{label}</span>
        <span aria-hidden>← 横にスライド（{items.length}件） →</span>
      </p>
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 sm:mx-0 sm:block sm:space-y-6 sm:overflow-visible sm:px-0">
        {items.map((item, i) => (
          <div key={i} className="w-[88%] shrink-0 snap-start sm:w-auto">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
