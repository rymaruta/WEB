"use client";

import { Children, useRef, useState, type ReactNode } from "react";

/**
 * 大きな記事の枠を、左右になぞって切り替えるカルーセル。次の記事が少し見えるようにして、横に続くことを分かるようにする。
 * 下の点で何本目かを示し、押すとその記事へ動く（画面を左右になぞってタブを切り替える操作とはぶつからない）
 */
export function HeroCarousel({ children, label }: { children: ReactNode; label: string }) {
  const slides = Children.toArray(children);
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    if (!el || !el.firstElementChild) return;
    const width = (el.firstElementChild as HTMLElement).offsetWidth;
    setActive(Math.min(slides.length - 1, Math.round(el.scrollLeft / Math.max(1, width))));
  };
  const go = (i: number) => {
    const el = ref.current;
    const slide = el?.children[i] as HTMLElement | undefined;
    if (el && slide) el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };
  if (slides.length <= 1) return <>{slides}</>;
  return (
    <section aria-roledescription="カルーセル" aria-label={label}>
      <div ref={ref} onScroll={onScroll} className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {slides.map((slide, i) => (
          <div key={i} aria-roledescription="スライド" aria-label={`${i + 1} / ${slides.length}`} className="w-[88%] shrink-0 snap-start sm:w-full">
            {slide}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`${i + 1}本目の記事`}
            aria-current={i === active ? "true" : undefined}
            className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-accent" : "w-2 bg-border hover:bg-fg-subtle"}`}
          />
        ))}
      </div>
    </section>
  );
}
