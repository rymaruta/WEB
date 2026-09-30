import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "運営方針・お問い合わせ",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 card p-5 text-[15px] leading-relaxed sm:p-8">
      <h1 className="text-2xl font-extrabold">運営方針・お問い合わせ</h1>

      <section>
        <h2 className="mb-2 text-lg font-bold">{siteConfig.name}について</h2>
        <p>
          {siteConfig.name}は、国内・国際・経済・IT・エンタメ・スポーツ・新商品まで、ジャンルを問わず主要メディアのニュースを一か所で確認できる総合ポータルです。
          同じ出来事を報じた複数の記事を自動で「トピック」にまとめ、各媒体の報道を読み比べられるようにしています。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">掲載方針</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>各媒体が公開している RSS 等の配信情報を取得し、見出し・短い要約（最大120文字）・元記事へのリンクのみを掲載します。記事本文や画像は転載しません。</li>
          <li>記事を読む際は、必ず各媒体のサイトへ移動します。</li>
          <li>収集は一定間隔で行い、各サイトに過度な負荷をかけないよう、同一サイトへの連続アクセスを制限しています。自動取得を拒否しているサイトからは収集しません。</li>
          <li>話題の順位は、報じた媒体数・SNS での反応・当サイトでの閲覧数と新しさから機械的に算出しており、編集部による恣意的な操作は行っていません。</li>
          <li>掲載しているメディアは<Link href="/sources" className="text-accent underline">掲載メディア一覧</Link>で公開しています。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">メディア関係者の方へ</h2>
        <p>
          掲載の停止、表示内容の修正、提携のご相談は、下記の窓口までご連絡ください。確認のうえ速やかに対応いたします。
          当サイトのクローラーは <code className="rounded bg-surface-muted px-1 text-sm">{siteConfig.crawlerUserAgent}</code> を名乗ります。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">免責事項</h2>
        <p>
          掲載情報は各媒体の配信内容に基づくもので、その正確性・完全性を当サイトが保証するものではありません。
          記事の内容に関するお問い合わせは、各媒体へお願いいたします。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">お問い合わせ</h2>
        <p>
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline">{siteConfig.contactEmail}</a>
        </p>
      </section>
    </article>
  );
}
