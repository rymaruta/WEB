import Link from "next/link";
import type { DigestSummary } from "@/lib/digest/latest";

const MARK = { MORNING: "☀️", LUNCH: "🕛", EVENING: "🌙" } as const;

/** X で配信した回の3本を、トップの一番上で同じ形のまま見せる */
export function DigestSummaryCard({ digest }: { digest: DigestSummary }) {
  return (
    <section aria-labelledby="digest" className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 pt-4 pb-3">
        <h2 id="digest" className="text-lg font-black tracking-tight">
          <span aria-hidden className="mr-1.5">{MARK[digest.slot]}</span>
          {digest.title}
          <span className="ml-2 inline-block text-xs font-bold whitespace-nowrap text-fg-muted">{digest.dateLabel}</span>
        </h2>
        <p className="shrink-0 text-[11px] text-fg-subtle">毎朝 7:00</p>
      </div>
      <ol>
        {digest.items.map((item, i) => (
          <li key={item.topicId} className="border-b border-border last:border-b-0">
            <Link href={`/topic/${item.topicId}`} className="flex gap-3 px-4 py-3 hover:bg-surface-muted">
              <span className="w-5 shrink-0 text-lg leading-snug font-black text-fg-muted tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1">
                {item.label && (
                  <span className="mb-0.5 flex items-center gap-1 text-[11px] font-bold" style={{ color: item.color }}>
                    <span aria-hidden className="inline-block h-2 w-2" style={{ background: item.color }} />
                    {item.label}
                  </span>
                )}
                <span className="block leading-snug font-bold">{item.headline}</span>
                {item.point && <span className="mt-0.5 block text-sm text-fg-muted">{item.point}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs font-bold">
        <Link href={digest.href} className="text-accent hover:underline">
          要点をまとめて読む →
        </Link>
        <Link href="/digest" className="text-fg-muted hover:text-fg">
          過去の配信
        </Link>
      </div>
    </section>
  );
}
