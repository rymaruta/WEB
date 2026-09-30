"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-8 text-center">
      <h1 className="text-xl font-extrabold">一時的なエラーが発生しました</h1>
      <p className="mt-2 text-sm text-fg-muted">時間をおいて再度お試しください。</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
      >
        再読み込み
      </button>
    </section>
  );
}
