import Link from "next/link";
import { SearchForm } from "@/components/search-form";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl card p-8 text-center">
      <h1 className="text-xl font-extrabold">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-fg-muted">
        URL が間違っているか、ページが削除された可能性があります。古いトピックは一定期間後に削除されます。
      </p>
      <SearchForm className="mt-6" />
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-accent hover:underline">
        トップページへ戻る
      </Link>
    </section>
  );
}
