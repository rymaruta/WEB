import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: `${siteConfig.name}へのお問い合わせ窓口です。記事の誤り、掲載の停止・修正のご依頼、広告・提携のご相談などを受け付けています。`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 card p-5 text-[15px] leading-relaxed sm:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold">お問い合わせ</h1>
        <p>
          {siteConfig.name}（運営：{siteConfig.operator}）へのお問い合わせは、下のフォームまたはメールでお送りください。内容を確認のうえ、原則として数日以内にご返信します。
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
          <li>記事の内容の誤りは、該当ページの URL を添えてお知らせください。確認のうえ速やかに修正します。</li>
          <li>掲載の停止・修正のご依頼は、媒体・権利者の方からのご連絡を優先して対応します。</li>
          <li>元の記事の内容そのものに関するお問い合わせは、各媒体へお願いいたします。</li>
        </ul>
      </header>

      <ContactForm />

      <section className="border-t border-border pt-4 text-sm">
        <h2 className="mb-1 font-bold">メールでのお問い合わせ</h2>
        <p>
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline">
            {siteConfig.contactEmail}
          </a>
        </p>
        <p className="mt-2 text-fg-muted">
          お預かりした情報の取り扱いは
          <Link href="/privacy" className="text-accent underline">
            プライバシーポリシー
          </Link>
          をご覧ください。
        </p>
      </section>
    </article>
  );
}
