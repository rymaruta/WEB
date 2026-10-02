import Link from "next/link";
import { CALENDAR_COLORS, CALENDAR_LABELS, type CalendarItem } from "@/lib/calendar-kinds";

/** 1日に出す件数（多い日は「ほか◯件」にまとめる） */
const PER_DAY = 4;

/**
 * 少しだけ見せる予定の選び方。ニュースになっている（話題のページがある）ものを先にし、分野が偏らないよう1分野ずつ順に取る
 * （ストアに並ぶだけのゲームが何十本もある日に、それだけで埋まらないように）
 */
export function pickHighlights(items: CalendarItem[], n = PER_DAY): CalendarItem[] {
  const covered = (it: CalendarItem) => (it.href && !it.external ? 0 : 1);
  const queues = new Map<string, CalendarItem[]>();
  for (const it of [...items].sort((a, b) => covered(a) - covered(b))) queues.set(it.category, [...(queues.get(it.category) ?? []), it]);
  // ニュースになっているものがある分野から順に回る
  const order = [...queues.entries()].sort((a, b) => covered(a[1][0]) - covered(b[1][0])).map(([, q]) => q);
  const out: CalendarItem[] = [];
  while (out.length < n && order.some((q) => q.length)) {
    for (const q of order) if (q.length && out.length < n) out.push(q.shift()!);
  }
  return out;
}

function DayRow({ title, items }: { title: string; items: CalendarItem[] }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-black text-fg-muted">
        {title}
        <span className="ml-1 font-bold text-fg-subtle">{items.length}件</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-fg-subtle">予定はありません</p>
      ) : (
        <ul className="space-y-1">
          {pickHighlights(items).map((it, i) => {
            const body = (
              <>
                <span className="shrink-0 rounded px-1.5 text-[10px] leading-4 font-bold text-white" style={{ backgroundColor: CALENDAR_COLORS[it.category] }}>
                  {CALENDAR_LABELS[it.category]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent">{it.title}</span>
              </>
            );
            return (
              <li key={`${it.title}-${i}`}>
                {it.href && !it.external ? (
                  <Link href={it.href} prefetch={false} className="group flex items-center gap-2">
                    {body}
                  </Link>
                ) : (
                  <Link href="/calendar" prefetch={false} className="group flex items-center gap-2">
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
          {items.length > PER_DAY && (
            <li className="text-xs text-fg-subtle">
              <Link href="/calendar" prefetch={false} className="hover:text-accent">
                ほか{items.length - PER_DAY}件
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * トップに出す「ぜんぶカレンダー」の入口。今日と明日の予定（ゲームの発売・アニメの放送開始・値上げなど）を少しだけ見せて、カレンダーへ誘う
 */
export function CalendarPreview({ today, tomorrow, items, weekCount }: { today: string; tomorrow: string; items: CalendarItem[]; weekCount: number }) {
  return (
    <section aria-labelledby="home-calendar" className="card border-accent/40 p-4 sm:p-5">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <h2 id="home-calendar" className="text-lg font-black">
            <Link href="/calendar" prefetch={false} className="hover:text-accent">
              ぜんぶカレンダー
            </Link>
          </h2>
          <p className="text-xs text-fg-subtle">ゲーム・アニメ・映画・新商品・値上げの予定を1つに</p>
        </div>
        <Link href="/calendar" prefetch={false} className="shrink-0 text-xs font-bold text-accent hover:underline">
          1週間で{weekCount}件 →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DayRow title="きょう" items={items.filter((it) => it.date === today)} />
        <DayRow title="あした" items={items.filter((it) => it.date === tomorrow)} />
      </div>
    </section>
  );
}
