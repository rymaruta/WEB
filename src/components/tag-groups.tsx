import Link from "next/link";
import { groupTagCounts, tagPath, type Tag, type TagKind } from "@/lib/tags";
import { Fold } from "./fold";
import { GroupTabs } from "./group-tabs";

/**
 * 国・地域、チームへの入口。競技・地域ごとのタブで切り替えて見せる
 * （1列に混ぜると探しにくく、すべてを縦に並べると長くなるため）。枠ごと閉じることもできる
 */
export function TagGroups({ kind, counts }: { kind: TagKind; counts: { tag: Tag; count: number }[] }) {
  const label = kind === "country" ? "国・地域" : "チーム";
  const groups = groupTagCounts(counts).map(({ group, total, items }) => ({
    key: group,
    label: group,
    note: String(total),
    content: (
      <ul className="flex flex-wrap gap-2">
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
    ),
  }));
  return (
    <Fold id={`tags-${kind}`} className="card px-4 py-3" summary={<span className="text-xs font-bold text-fg-muted">{label}</span>}>
      <nav aria-label={`${label}で見る`} className="mt-2">
        <GroupTabs id={`tags-${kind}`} label={`${label}のまとまり`} groups={groups} />
      </nav>
    </Fold>
  );
}
