import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { getReviewQueue, REVIEW_FLAG_LABELS } from "@/lib/review";
import { reviewAction } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * 記事の点検（編集部）。直近に書いたまとめ記事を、プログラムが付けた手がかりの多い順に並べる。
 * 記事を開いて出典と見比べ、「確認済み」「書き直し」「検索から外す」を選ぶ。確認済みの記事にだけ、記事のページに「編集部が確認」と出る
 */
export default async function ReviewPage() {
  const queue = await getReviewQueue();
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold">記事の点検</h1>
        <p className="mt-1 text-sm text-fg-muted">
          直近14日に書いた、まだ確認していないまとめ記事です（確認の後に書き直したものを含む）。記事を開いて元の記事と見比べ、内容に誤り・古さ・別の出来事の混入がないかを確かめてください。1日1回、上から順に確認するのが目安です。
        </p>
        <p className="mt-1 text-sm text-fg-muted">残り {queue.length} 本</p>
      </header>
      {queue.length === 0 && <p className="card p-4 text-sm text-fg-muted">点検する記事はありません。</p>}
      <ul className="space-y-3">
        {queue.map((t) => (
          <li key={t.id} className="card p-4">
            <p className="text-xs text-fg-subtle">
              {t.aiGeneratedAt && formatDateTime(t.aiGeneratedAt)}に作成・{t.publisherCount}媒体
              {t.reviewStatus === "ok" && "・確認の後に書き直し"}
            </p>
            <Link href={`/topic/${t.id}`} target="_blank" className="mt-0.5 block font-bold leading-snug hover:text-accent">
              {t.aiTitle ?? t.title} ↗
            </Link>
            {t.flags.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1">
                {t.flags.map((f) => (
                  <li key={f} className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 text-[11px] font-bold">
                    {REVIEW_FLAG_LABELS[f]}
                  </li>
                ))}
              </ul>
            )}
            <form className="mt-2 space-y-2">
              <input name="note" placeholder="メモ（直した点・外した理由。任意）" className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button formAction={reviewAction.bind(null, t.id, "ok")} className="rounded-full bg-accent px-3 py-1.5 text-sm font-bold text-accent-fg">
                  確認済み
                </button>
                <button formAction={reviewAction.bind(null, t.id, "rewrite")} className="rounded-full border border-border px-3 py-1.5 text-sm font-bold">
                  書き直し
                </button>
                <button formAction={reviewAction.bind(null, t.id, "hold")} className="rounded-full border border-border px-3 py-1.5 text-sm font-bold text-fg-muted">
                  検索から外す
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
