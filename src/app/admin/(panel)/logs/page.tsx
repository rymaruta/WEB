import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

/** 動作の記録（直近 100 件）。障害の調査に使う */
export default async function LogsPage() {
  const logs = await prisma.eventLog.findMany({ orderBy: { at: "desc" }, take: 100 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold">記録</h1>
      <ul className="divide-y divide-border card text-sm">
        {logs.map((l) => (
          <li key={String(l.id)} className="p-3">
            <p className="text-xs text-fg-muted tabular-nums">
              {formatDateTime(l.at)} ・ {l.scope} ・ <span className={l.level === "error" ? "font-bold text-accent" : ""}>{l.level}</span>
            </p>
            <p>{l.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
