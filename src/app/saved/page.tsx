import type { Metadata } from "next";
import { SavedList } from "./saved-list";

export const metadata: Metadata = {
  title: "あとで読む",
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <h1 className="text-xl font-extrabold">あとで読む</h1>
      <p className="mt-1 mb-4 text-xs text-fg-subtle">保存した記事は、この端末のブラウザーにだけ保存されます（最大100件）。</p>
      <SavedList />
    </section>
  );
}
