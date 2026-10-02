import type { MarketPoint, MarketSnapshot } from "@/lib/market";
import { Fold } from "./fold";

function Item({ label, point, unit, digits, note }: { label: string; point: MarketPoint; unit: string; digits: number; note: string }) {
  const diff = point.prev === null ? null : point.value - point.prev;
  const [, m, d] = point.date.split("-").map(Number);
  const sign = diff === null ? "" : diff > 0 ? "+" : diff < 0 ? "−" : "±";
  const color = diff === null || diff === 0 ? "text-fg-muted" : diff > 0 ? "text-[var(--up,#c0392b)]" : "text-[var(--down,#1f6fb2)]";
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-bold text-fg-muted">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-black tabular-nums">
          {point.value.toFixed(digits)}
          <span className="ml-0.5 text-xs font-bold">{unit}</span>
        </span>
        {diff !== null && (
          <span className={`text-xs font-bold tabular-nums ${color}`}>
            {sign}
            {Math.abs(diff).toFixed(digits)}
          </span>
        )}
      </div>
      <div className="text-[10px] text-fg-subtle">
        {m}/{d} {note}・前の日と比べて
      </div>
    </div>
  );
}

/** 経済のページの市況。ドル円（日本銀行）と長期金利（財務省） */
export function MarketBar({ data }: { data: MarketSnapshot }) {
  if (!data.usdjpy && !data.jgb10) return null;
  return (
    <section aria-label="市況" className="card p-4">
      <Fold id="market" summary={<h2 className="text-base font-extrabold">市況</h2>}>
        <div className="mt-2 flex gap-4">
          {data.usdjpy && <Item label="ドル円" point={data.usdjpy} unit="円" digits={2} note="17時" />}
          {data.jgb10 && <Item label="長期金利（10年国債）" point={data.jgb10} unit="%" digits={3} note="" />}
        </div>
        <p className="mt-2 text-[10px] text-fg-subtle">出典：日本銀行「時系列統計データ」、財務省「国債金利情報」</p>
      </Fold>
    </section>
  );
}
