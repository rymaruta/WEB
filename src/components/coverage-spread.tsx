import { elapsedLabel, minutesToReach, reportsWithin, type SpreadPoint } from "@/lib/coverage";
import { publisherLabel } from "@/lib/publisher";

const W = 320;
const H = 120;
const PAD = { l: 24, r: 8, t: 8, b: 20 };

/** 横軸の目盛り（分）。報道が続いた長さに合わせる */
function ticks(max: number): number[] {
  const steps = [30, 60, 180, 360, 720, 1440, 2880, 4320, 10080];
  const step = steps.find((s) => max / s <= 4) ?? 10080;
  const out: number[] = [];
  for (let m = 0; m <= max; m += step) out.push(m);
  return out;
}

/**
 * 報道の広がり（独立した媒体の数の累積）。ぜんぶナビが複数の媒体を同時に集めているから分かる、このサイト独自のデータ。
 * 図は読み上げ用の説明と、文字の要約を必ず添える
 */
export function CoverageSpread({ points }: { points: SpreadPoint[] }) {
  if (points.length < 3) return null;
  const last = points[points.length - 1];
  const maxX = Math.max(60, last.minutes);
  const maxY = last.count;
  const x = (m: number) => PAD.l + (m / maxX) * (W - PAD.l - PAD.r);
  const y = (c: number) => H - PAD.b - (c / maxY) * (H - PAD.t - PAD.b);
  // 階段状の線（報じた時刻で1段ずつ上がる）
  let d = `M${x(0)},${y(0)}`;
  for (const p of points) d += ` H${x(p.minutes).toFixed(1)} V${y(p.count).toFixed(1)}`;
  d += ` H${x(maxX)}`;
  const in1h = reportsWithin(points, 60);
  const in6h = reportsWithin(points, 360);
  const to3 = minutesToReach(points, 3);
  const summary = [
    `最初の報道は${publisherLabel(points[0].publisher)}`,
    `1時間以内に${in1h}社`,
    in6h > in1h ? `6時間以内に${in6h}社` : null,
    `最終的に${last.count}社が報道`,
    to3 !== null ? `3社目までは${to3 === 0 ? "同時" : elapsedLabel(to3).replace("+", "")}` : null,
  ]
    .filter(Boolean)
    .join("、");
  return (
    <figure className="my-3 rounded-xl border border-border p-3">
      <figcaption className="text-sm font-bold">報道の広がり</figcaption>
      <p className="mt-0.5 text-[13px] text-fg-muted">{summary}。</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full text-accent" role="img" aria-label={`報道の広がりのグラフ。${summary}`}>
        {ticks(maxX).map((m) => (
          <g key={m}>
            <line x1={x(m)} x2={x(m)} y1={PAD.t} y2={H - PAD.b} className="stroke-border" strokeWidth={0.5} />
            <text x={x(m)} y={H - 6} textAnchor="middle" className="fill-fg-subtle" fontSize={9}>
              {m === 0 ? "最初" : elapsedLabel(m)}
            </text>
          </g>
        ))}
        <text x={PAD.l - 4} y={y(maxY) + 3} textAnchor="end" className="fill-fg-subtle" fontSize={9}>
          {maxY}
        </text>
        <text x={PAD.l - 4} y={y(0) + 3} textAnchor="end" className="fill-fg-subtle" fontSize={9}>
          0
        </text>
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.publisher} cx={x(p.minutes)} cy={y(p.count)} r={2.5} fill="currentColor">
            <title>{`${publisherLabel(p.publisher)}（${p.minutes === 0 ? "最初" : elapsedLabel(p.minutes)}）`}</title>
          </circle>
        ))}
      </svg>
      <p className="mt-1 text-[11px] text-fg-subtle">縦軸は報じた媒体の数（転載・再配信を除く）、横軸は最初の報道からの経過。ぜんぶナビが各媒体の配信を確認した時刻に基づきます。</p>
    </figure>
  );
}
