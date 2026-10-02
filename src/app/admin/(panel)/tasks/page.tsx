import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { createTaskAction } from "../../actions";
import { TaskForm } from "./task-form";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; className: string }> = {
  queued: { label: "作業中", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  done: { label: "完了", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  failed: { label: "できなかった", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
};

/** 何でも頼める作業：書いたことを AI（Claude Code の定期実行・無料）が行い、結果をこことメールで返す */
export default async function TasksPage() {
  const tasks = await prisma.adminTask.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold">AI に頼む</h1>
        <p className="mt-1 text-sm text-fg-muted">
          サイトの調べもの・数字の確認・記事の見直しなどを、AI（Claude）が行います（AI の料金はかかりません）。X への投稿・削除は、頼んだときだけ行い、そのたびにメールで知らせます（X の投稿料金は1件約2円、URL 付きは約30円。URL 付きは「リンク」「URL」と頼んだときだけ）。
        </p>
      </header>
      <section className="card p-4">
        <TaskForm action={createTaskAction} />
      </section>
      <ul className="space-y-3">
        {tasks.map((t) => {
          const s = STATUS[t.status] ?? STATUS.queued;
          return (
            <li key={t.id} className="card p-4">
              <p className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                <span className={`rounded-full px-2 py-0.5 font-bold ${s.className}`}>{s.label}</span>
                <span className="tabular-nums">{formatDateTime(t.createdAt)}</span>
                {t.sessionUrl && (
                  <a href={t.sessionUrl} target="_blank" rel="noopener" className="underline">
                    作業の様子
                  </a>
                )}
              </p>
              <p className="mt-2 font-bold whitespace-pre-wrap">{t.prompt}</p>
              {t.result && <p className="mt-2 rounded-lg bg-surface-muted p-3 text-sm whitespace-pre-wrap">{t.result}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
