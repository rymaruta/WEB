/** ページを読み込んでいる間の仮の表示。タブやリンクを押したことがすぐ分かるように、押した直後に出す */
export function PageSkeleton({ rows = 6, header = true }: { rows?: number; header?: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {header && <div className="h-16 animate-pulse rounded-2xl bg-surface-muted" />}
      <div className="card space-y-3 p-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
      <p className="sr-only">読み込み中</p>
    </div>
  );
}
