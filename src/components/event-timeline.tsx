import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { TimelineEntry } from "@/lib/topics/timeline";

/** 同じ出来事のこれまでの流れ。話題ページで、いま読んでいる記事がどの段階かを示す */
export function EventTimeline({ entries, currentId }: { entries: TimelineEntry[]; currentId: number }) {
  if (entries.length < 2) return null;
  return (
    <section aria-labelledby="event-timeline" className="mb-6 rounded-xl border border-border bg-surface-muted/40 p-4">
      <h2 id="event-timeline" className="mb-2 text-sm font-bold">
        この出来事の流れ
      </h2>
      <ol className="relative border-l-2 border-border pl-4">
        {entries.map((e) => {
          const current = e.id === currentId;
          return (
            <li key={e.id} className="relative my-2.5">
              <span
                aria-hidden
                className={`absolute top-1.5 -left-[23px] h-2.5 w-2.5 rounded-full border-2 border-surface ${current ? "bg-accent" : "bg-fg-subtle"}`}
              />
              <time dateTime={e.firstSeenAt.toISOString()} className="block text-xs text-fg-subtle tabular-nums">
                {formatDateTime(e.firstSeenAt)}
              </time>
              {current ? (
                <p className="text-sm leading-snug font-bold" aria-current="page">
                  {e.title}
                  <span className="ml-1.5 rounded bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-accent">このページ</span>
                </p>
              ) : (
                <Link href={`/topic/${e.id}`} className="text-sm leading-snug hover:text-accent hover:underline">
                  {e.title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
