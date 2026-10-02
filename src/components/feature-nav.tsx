import Link from "next/link";
import { weekKey } from "@/lib/weekly";
import { FEATURE_KINDS, featurePath, featureShortName, jstMonth, type FeatureKind } from "@/lib/features";
import { Fold } from "./fold";

const chip = "inline-block rounded-full border px-3 py-1 text-xs font-bold";
const normal = `${chip} border-border bg-surface text-fg-muted hover:border-accent hover:text-accent`;
const selected = `${chip} border-accent bg-accent text-accent-fg`;

/**
 * 特集の入口。種類の違うページを1列に混ぜず、「データで見る」「今月の特集」「来月の特集」に分けて、
 * それぞれ閉じられるようにする（current は選んだ状態で出す）
 */
export function FeatureNav({ current, className = "mt-4" }: { current?: { kind: FeatureKind; month: string }; className?: string }) {
  const months = [jstMonth(), jstMonth(new Date(), 1)];
  const data = [
    { href: "/following", label: "★ フォロー中" },
    { href: "/calendar", label: "ぜんぶカレンダー" },
    { href: `/weekly/${weekKey()}`, label: "今週の10大ニュース" },
    { href: "/prices", label: "値上げ・値下げデータベース" },
    { href: "/compare", label: "報道くらべ" },
  ];
  const groups = [
    { id: "feature-data", title: "データで見る", links: data.map((l) => ({ ...l, active: false })) },
    ...months.map((month, i) => ({
      id: i === 0 ? "feature-this-month" : "feature-next-month",
      title: `${Number(month.slice(5, 7))}月の特集`,
      links: FEATURE_KINDS.map((kind) => ({
        href: featurePath(kind, month),
        label: featureShortName(kind, month),
        active: current?.kind === kind && current.month === month,
      })),
    })),
  ];
  return (
    <nav aria-label="特集" className={`space-y-1 ${className}`}>
      {groups.map((g) => (
        <Fold key={g.id} id={g.id} className="rounded-lg border border-border px-3 py-2" summary={<span className="text-sm font-bold">{g.title}</span>}>
          <ul className="mt-2 flex flex-wrap gap-2">
            {g.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} prefetch={false} aria-current={l.active ? "page" : undefined} className={l.active ? selected : normal}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </Fold>
      ))}
    </nav>
  );
}
