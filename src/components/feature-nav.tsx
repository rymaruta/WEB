import Link from "next/link";
import { weekKey } from "@/lib/weekly";
import { FEATURE_KINDS, featurePath, featureShortName, jstMonth, type FeatureKind } from "@/lib/features";
import { GroupTabs } from "./group-tabs";

const chip = "inline-block rounded-full border px-3 py-1 text-xs font-bold";
const normal = `${chip} border-border bg-surface text-fg-muted hover:border-accent hover:text-accent`;
const selected = `${chip} border-accent bg-accent text-accent-fg`;

/**
 * 特集の入口。種類の違うページを1列に混ぜず、「データで見る」「今月の特集」「来月の特集」のタブで切り替える
 * （すべてを縦に並べると長くなるため）。current は選んだ状態で出し、そのタブを開いておく
 */
export function FeatureNav({ current, className = "mt-4" }: { current?: { kind: FeatureKind; month: string }; className?: string }) {
  const months = [jstMonth(), jstMonth(new Date(), 1)];
  const data = [
    { href: "/following", label: "★ フォロー中", active: false },
    { href: "/calendar", label: "ぜんぶカレンダー", active: false },
    { href: `/weekly/${weekKey()}`, label: "今週の10大ニュース", active: false },
    { href: "/daily", label: "日付別ニュース", active: false },
    { href: "/prices", label: "値上げ・値下げデータベース", active: false },
    { href: "/compare", label: "報道くらべ", active: false },
    { href: "/youtube", label: "YouTube 新着動画", active: false },
  ];
  const groups = [
    { key: "data", label: "データで見る", links: data },
    ...months.map((month, i) => ({
      key: i === 0 ? "this-month" : "next-month",
      label: `${Number(month.slice(5, 7))}月の特集`,
      links: FEATURE_KINDS.map((kind) => ({
        href: featurePath(kind, month),
        label: featureShortName(kind, month),
        active: current?.kind === kind && current.month === month,
      })),
    })),
  ];
  const initial = current ? groups.find((g) => g.links.some((l) => l.active))?.key : undefined;
  return (
    <nav aria-label="特集" className={className}>
      <GroupTabs
        id="feature-nav"
        label="特集の種類"
        initial={initial}
        groups={groups.map((g) => ({
          key: g.key,
          label: g.label,
          content: (
            <ul className="flex flex-wrap gap-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} prefetch={false} aria-current={l.active ? "page" : undefined} className={l.active ? selected : normal}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          ),
        }))}
      />
    </nav>
  );
}
