import Link from "next/link";
import { relativeTime } from "@/lib/format";
import type { TopicBrief as Brief } from "@/lib/topics/brief";

/** 「3行でわかる」：何が起きたか・なぜ重要か・その後どうなったか。話題ページの冒頭に置き、読む手間を減らす */
export function TopicBrief({ brief, lastSeenAt, latest }: { brief: Brief; lastSeenAt: Date; latest?: { text: string; at: Date } | null }) {
  const rows: { label: string; body: React.ReactNode }[] = [
    { label: "何が起きた", body: brief.what },
    ...(brief.why ? [{ label: "なぜ重要", body: brief.why }] : []),
    {
      label: "その後",
      body: brief.next ? (
        <Link href={`/topic/${brief.next.id}`} className="font-bold text-accent hover:underline">
          {brief.next.title}
          <span className="ml-1.5 text-xs font-normal text-fg-subtle">（{relativeTime(brief.next.at)}）</span>
        </Link>
      ) : latest ? (
        // 同じ出来事の別の話題がなくても、この話題のその後の動き（新たな報道・続報・公式の発表）があれば、その最新を出す
        <a href="#topic-updates" className="hover:text-accent">
          {latest.text}
          <span className="ml-1.5 text-xs text-fg-subtle">（{relativeTime(latest.at)}・その後の動きを見る ↓）</span>
        </a>
      ) : (
        <span className="text-fg-muted">続報はまだありません（最新の報道 {relativeTime(lastSeenAt)}）</span>
      ),
    },
  ];
  return (
    <section aria-labelledby="topic-brief" className="mb-5 rounded-xl border border-border bg-surface p-4">
      <h2 id="topic-brief" className="mb-2 text-sm font-black">
        3行でわかる
      </h2>
      <dl className="grid gap-2 text-sm leading-relaxed">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[5.5em_minmax(0,1fr)] gap-2">
            <dt className="font-bold text-fg-muted">{r.label}</dt>
            <dd className="min-w-0">{r.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
