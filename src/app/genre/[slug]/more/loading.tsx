/** 2ページ目以降を読み込んでいる間の表示（押したことがすぐ分かるように） */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
      <div className="card space-y-3 p-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
      <p className="sr-only">読み込み中</p>
    </div>
  );
}
