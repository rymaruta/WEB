import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "利用規約・免責事項",
  description: `${siteConfig.name}の利用規約と免責事項です。`,
  alternates: { canonical: "/terms" },
};

/** 制定日・改定日。内容を変えたら更新する */
const UPDATED_AT = "2026年10月4日";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 card p-5 text-[15px] leading-relaxed sm:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold">利用規約・免責事項</h1>
        <p className="text-sm text-fg-subtle">制定・最終改定: {UPDATED_AT}</p>
      </header>

      <p>
        この利用規約（以下「本規約」）は、{siteConfig.operator}（以下「運営者」）が提供する{siteConfig.name}（以下「当サイト」）の利用条件を定めるものです。当サイトを利用された時点で、本規約に同意いただいたものとみなします。
      </p>

      <section>
        <h2 className="mb-2 text-lg font-bold">1. 当サイトの内容</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>当サイトは、各報道機関・企業が公開している記事の見出し・短い要約と元の記事へのリンクを、ジャンル・出来事ごとに整理して紹介するサービスです。</li>
          <li>まとめ記事・要点・報道の比較などは、複数の媒体の見出しと要約をもとに、運営者が設けた手順に沿って作成しています（一部に AI を利用し、資料との照合を経て掲載しています）。</li>
          <li>X（旧 Twitter）などの公式アカウントでの配信も、当サイトの一部として本規約が適用されます。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">2. 著作権</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>各記事の見出し・本文・画像の著作権は、それぞれの報道機関・権利者に帰属します。記事の全文は当サイトに掲載していません。</li>
          <li>当サイトが独自に作成した文章・図表・データ（まとめ記事、報道の比較、値上げ・値下げデータベースなど）の著作権は運営者に帰属します。</li>
          <li>引用の範囲を超えて、当サイトの内容を無断で転載・複製・再配布することを禁じます。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">3. 禁止事項</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>法令または公序良俗に反する行為</li>
          <li>当サイトや第三者の権利・利益を侵害する行為</li>
          <li>当サイトの運営を妨げる行為（過度な自動アクセス、データの大量取得など）</li>
          <li>当サイトの内容を、誤解を招く形で改変・利用する行為</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">4. 免責事項</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>運営者は、掲載する情報の正確性・完全性・最新性の確保に努めますが、これらを保証するものではありません。情報は各報道機関の発表時点のものであり、その後に変わっている場合があります。</li>
          <li>まとめ記事・要点は元の記事の内容を短くまとめたものです。重要な判断をされる際は、必ず元の記事や公式の発表をご確認ください。</li>
          <li>リンク先の外部サイトの内容、およびそのサイトの利用により生じた損害について、運営者は責任を負いません。</li>
          <li>当サイトの利用により生じたいかなる損害についても、運営者に故意または重大な過失がある場合を除き、責任を負いかねます。</li>
          <li>当サイトは、予告なく内容の変更・公開の停止を行うことがあります。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">5. 広告について</h2>
        <p>
          当サイトは、第三者配信の広告サービス（Google AdSense）を利用しています。広告の配信に関する情報の取り扱いは
          <Link href="/privacy" className="text-accent underline">
            プライバシーポリシー
          </Link>
          をご覧ください。広告の内容・商品・サービスについて、運営者は責任を負いません。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">6. 誤りの訂正・掲載の停止</h2>
        <p>
          掲載内容の誤りのご指摘や、権利者の方からの掲載停止・修正のご依頼は、
          <Link href="/contact" className="text-accent underline">
            お問い合わせ
          </Link>
          からご連絡ください。確認のうえ速やかに対応いたします。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">7. 規約の変更・準拠法</h2>
        <p>運営者は、必要に応じて本規約を変更できるものとします。変更後の規約は、当サイトに掲載した時点から効力を生じます。本規約は日本法に準拠します。</p>
      </section>

      <section className="border-t border-border pt-4 text-sm text-fg-muted">
        <p>
          運営：{siteConfig.operator}（
          <Link href="/about" className="text-accent underline">
            運営者情報
          </Link>
          ）
        </p>
      </section>
    </article>
  );
}
