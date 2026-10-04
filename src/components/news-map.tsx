import Link from "next/link";
import { MAP_KIND_LABELS, type MapEntityKind, type MapLink } from "@/lib/news-map";

const W = 360;
const H = 260;
const CX = W / 2;
const CY = H / 2;

const KIND_COLOR: Record<MapEntityKind, string> = {
  company: "var(--accent)",
  game: "var(--g-game)",
  anime: "var(--g-anime)",
  country: "var(--g-world)",
  team: "var(--g-sports)",
};

/** 図の中の名前は短く（全文は一覧と読み上げ用の説明に出す） */
const short = (s: string) => (s.length > 9 ? `${s.slice(0, 8)}…` : s);

/**
 * ニュース相関図（src/lib/news-map.ts）。中心の企業と、同じニュースに出てきたものを線で結ぶ。
 * 線の太さ・点の大きさは、一緒に出たニュースの数。点を選ぶとそのページへ移る。
 * 図の下に、つながりごとの根拠のニュースを必ず並べる（図だけで判断させない。読み上げ・スマホでも追える）
 */
export function NewsMap({ center, links }: { center: string; links: MapLink[] }) {
  if (links.length === 0) return null;
  const max = Math.max(...links.map((l) => l.count));
  const nodes = links.map((l, i) => {
    // 真上から時計回りに等間隔で並べる
    const a = -Math.PI / 2 + (i / links.length) * Math.PI * 2;
    return { l, x: CX + Math.cos(a) * 128, y: CY + Math.sin(a) * 92, r: 6 + (l.count / max) * 8, w: 1 + (l.count / max) * 4 };
  });
  const summary = `${center}と同じニュースに出てきたもの：${links.map((l) => `${l.entity.name}（${l.count}件）`).join("、")}`;
  return (
    <section aria-labelledby="news-map" className="my-4 rounded-xl border border-border p-4">
      <h2 id="news-map" className="text-sm font-black">
        ニュース相関図
      </h2>
      <p className="mt-0.5 text-xs text-fg-subtle">
        {center}と同じニュースに出てきた企業・作品・国・チームです。線が太いほど、一緒に出たニュースが多いことを示します。関係の中身（提携・競合など）は表していません。
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-auto w-full max-w-md" role="img" aria-label={summary}>
        {nodes.map(({ l, x, y, w }) => (
          <line key={`l-${l.entity.kind}-${l.entity.key}`} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--border)" strokeWidth={w} strokeLinecap="round" />
        ))}
        <g>
          <rect x={CX - 52} y={CY - 15} width={104} height={30} rx={15} fill="var(--fg)" />
          <text x={CX} y={CY + 5} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--bg)">
            {short(center)}
          </text>
        </g>
        {nodes.map(({ l, x, y, r }) => (
          <Link key={`n-${l.entity.kind}-${l.entity.key}`} href={l.entity.href} prefetch={false}>
            <g className="hover:opacity-80">
              <circle cx={x} cy={y} r={r} fill={KIND_COLOR[l.entity.kind]} />
              <text x={x} y={y + r + 13} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--fg)">
                {short(l.entity.name)}
              </text>
            </g>
          </Link>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-subtle" aria-hidden>
        {(Object.keys(MAP_KIND_LABELS) as MapEntityKind[])
          .filter((k) => links.some((l) => l.entity.kind === k))
          .map((k) => (
            <li key={k} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR[k] }} />
              {MAP_KIND_LABELS[k]}
            </li>
          ))}
      </ul>
      <h3 className="mt-3 text-xs font-bold text-fg-muted">つながりの根拠（一緒に出たニュース）</h3>
      <ul className="mt-1 divide-y divide-border text-sm">
        {links.map((l) => (
          <li key={`${l.entity.kind}-${l.entity.key}`} className="py-2">
            <p>
              <Link href={l.entity.href} prefetch={false} className="font-bold hover:text-accent">
                {l.entity.name}
              </Link>
              <span className="ml-1.5 text-xs text-fg-subtle">
                {MAP_KIND_LABELS[l.entity.kind]}・{l.count}件
              </span>
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {l.topics.map((t) => (
                <li key={t.id} className="truncate text-[13px] text-fg-muted">
                  <Link href={`/topic/${t.id}`} prefetch={false} className="hover:text-accent hover:underline">
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
