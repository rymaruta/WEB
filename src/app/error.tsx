"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reloadOnce } from "@/lib/client/reload-once";

/**
 * ページの表示中のエラー。サイトの更新直後に古い画面から移ろうとしたときに起きやすいため、
 * まず一度だけ自動で読み直し、それでも出るときにこの画面を見せる
 */
export default function Error({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reloadOnce();
  }, [error]);
  return (
    <section className="mx-auto max-w-xl card p-8 text-center">
      <h1 className="text-xl font-extrabold">ページを表示できませんでした</h1>
      <p className="mt-2 text-sm text-fg-muted">サイトの更新直後などに起きることがあります。再読み込みすると表示されます。</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:opacity-90"
        >
          再読み込み
        </button>
        <Link href="/" className="rounded-md border border-border px-5 py-2 text-sm font-semibold hover:border-accent hover:text-accent">
          トップへ
        </Link>
      </div>
    </section>
  );
}
