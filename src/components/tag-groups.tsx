import Link from "next/link";
import { groupTagCounts, tagPath, type Tag, type TagKind } from "@/lib/tags";
import { Fold } from "./fold";

/**
 * 国・地域、チームへの入口。競技・地域ごとに見出しを付けて分け、それぞれ閉じられるようにする
 * （「サッカー日本代表」と「巨人」が1列に混ざって並ぶと、探しにくいため）
 */
export function TagGroups({ kind, counts }: { kind: TagKind; counts: { tag: Tag; count: number }[] }) {
  const label = kind === "country" ? "国・地域" : "チーム";
  return (
    <Fold id={`tags-${kind}`} className="card px-4 py-3" summary={<span className="text-xs font-bold text-fg-muted">{label}</span>}>
      <nav aria-label={`${label}で見る`} className="mt-2 space-y-1">
        {groupTagCounts(counts).map(({ group, total, items }) => (
          <Fold
            key={group}
            id={`tags-${kind}-${group}`}
            className="rounded-lg border border-border px-3 py-2"
            summary={
              <span className="text-sm font-bold">
                {group}
                <span className="ml-1.5 text-xs font-normal text-fg-subtle">{total}件</span>
              </span>
            }
          >
            <ul className="mt-2 flex flex-wrap gap-2">
              {items.map(({ tag, count }) => (
                <li key={tag.slug}>
                  <Link
                    href={tagPath(tag)}
                    prefetch={false}
                    className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent"
                  >
                    {tag.name}
                    <span className="ml-1 font-normal text-fg-subtle">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Fold>
        ))}
      </nav>
    </Fold>
  );
}
