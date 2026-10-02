import Link from "next/link";
import { FEATURE_KINDS, featurePath, featureShortName, jstMonth, type FeatureKind } from "@/lib/features";

/** 特集の入口。今月・来月の各特集へのリンクを並べる（current は選んだ状態で出す） */
export function FeatureNav({ current, className = "mt-4" }: { current?: { kind: FeatureKind; month: string }; className?: string }) {
  const months = [jstMonth(), jstMonth(new Date(), 1)];
  const links = months.flatMap((month) => FEATURE_KINDS.map((kind) => ({ kind, month })));
  return (
    <nav aria-label="特集" className={`scrollbar-none flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {links.map(({ kind, month }) => {
        const active = current?.kind === kind && current.month === month;
        return (
          <Link
            key={`${kind}-${month}`}
            href={featurePath(kind, month)}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-fg-muted hover:border-accent hover:text-accent"}`}
          >
            {featureShortName(kind, month)}
          </Link>
        );
      })}
    </nav>
  );
}
