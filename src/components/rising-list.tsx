import Link from "next/link";
import type { TopicCardData } from "@/lib/queries";
import { GenreBadge } from "./genre-badge";
import { ReadTitle } from "./read-title";

/** 急上昇の一覧。直近に新しく報じた媒体の数を添える */
export function RisingList({ items, hours }: { items: { topic: TopicCardData; recent: number }[]; hours: number }) {
  if (items.length === 0) {
    return <p className="py-3 text-sm text-fg-subtle">いま急に広がっている話題はありません。</p>;
  }
  return (
    <ol className="divide-y divide-border">
      {items.map(({ topic, recent }, i) => (
        <li key={topic.id}>
          <Link href={`/topic/${topic.id}`} data-topic-id={topic.id} className="group flex gap-3 py-2.5">
            <span className="w-5 shrink-0 text-right text-sm font-black text-accent tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug font-medium group-hover:text-accent">
                <ReadTitle id={topic.id}>{topic.aiTitle ?? topic.title}</ReadTitle>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <GenreBadge genre={topic.genre} />
                <span className="font-bold text-accent">
                  ↑ {hours}時間で{recent}媒体が報道
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
