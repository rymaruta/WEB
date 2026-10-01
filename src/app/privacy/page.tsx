import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  alternates: { canonical: "/privacy" },
};

/** 制定日・改定日。内容を変えたら更新する */
const UPDATED_AT = "2026年10月1日";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 card p-5 text-[15px] leading-relaxed sm:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold">プライバシーポリシー</h1>
        <p className="text-sm text-fg-subtle">制定・最終改定: {UPDATED_AT}</p>
      </header>

      <p>
        {siteConfig.name}（以下「当サイト」）は、利用者の情報を次のとおり取り扱います。
      </p>

      <section>
        <h2 className="mb-2 text-lg font-bold">1. 取得する情報</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>閲覧の記録: 閲覧したページ、日時、ブラウザーや端末の種類、参照元など（サーバーの記録とアクセス解析による）。</li>
          <li>元記事へのリンクが開かれた回数（記事ごとの合計のみ。誰が開いたかは記録しません）。</li>
          <li>お問い合わせの際にご連絡いただいたメールアドレスと内容。</li>
        </ul>
        <p className="mt-2">氏名・住所などの個人情報の入力を求めることはありません。</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">2. 利用目的</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>サイトの表示速度や使いやすさの改善、障害の調査</li>
          <li>記事の閲覧数ランキングの集計</li>
          <li>お問い合わせへの回答</li>
          <li>広告の配信と、その効果の測定（第3項）</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">3. 広告について</h2>
        <p>
          当サイトは、第三者配信の広告サービス（Google アドセンス）を利用します。Google などの広告配信事業者は、利用者の興味に応じた広告を表示するため、Cookie を使用して、当サイトや他のサイトへの過去のアクセス情報に基づいて広告を配信することがあります。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Google が広告 Cookie を使用することにより、利用者が当サイトや他のサイトにアクセスした際の情報に基づいて、Google やそのパートナーが適切な広告を表示できます。
          </li>
          <li>
            パーソナライズ広告は、
            <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Google の広告設定
            </a>
            で無効にできます。また、
            <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              aboutads.info
            </a>
            から、第三者配信事業者の Cookie を無効にできます。
          </li>
          <li>
            詳しくは
            <a href="https://policies.google.com/technologies/ads?hl=ja" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Google の広告に関するポリシー
            </a>
            をご覧ください。
          </li>
        </ul>
        <p className="mt-2">広告は、記事を読む妨げにならない位置と量に限って掲載します。</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">4. アクセス解析について</h2>
        <p>
          サイトの改善のため、Amazon CloudWatch RUM で閲覧数や表示速度、閲覧環境を集計しています。この解析では Cookie を使用せず、個人を特定できる情報は収集しません。
        </p>
        <p className="mt-2">
          また、どのページがどこ（検索エンジン・SNS など）から見られているかを把握するため、ページを開いたときに「開いたページ」と「参照元のサイト」を当サイトに送り、日ごとの合計件数だけを記録しています。IP アドレスや端末の情報など、個人を特定できる情報は保存しません。
        </p>
        <p className="mt-2">
          前回の訪問のあとに出たニュースに「NEW」の印を付けるため、最後に訪問した日時を利用者の端末（ブラウザーの保存領域）にだけ保存しています。「あとで読む」で保存した記事の一覧と、読んだ記事の見出しを薄く表示するための既読の記録も、同じく利用者の端末にだけ保存しています。これらの情報は当サイトのサーバーには送信されません。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">5. 第三者への提供</h2>
        <p>
          法令に基づく場合を除き、取得した情報を本人の同意なく第三者に提供することはありません。ただし、第3項の広告配信事業者が Cookie によって情報を取得する場合は、各事業者のプライバシーポリシーに従います。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">6. 情報の管理</h2>
        <p>取得した情報は、漏えい・改ざん・紛失を防ぐため、通信の暗号化やアクセスの制限などにより適切に管理します。不要になった情報は削除します。</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">7. 掲載内容と著作権</h2>
        <p>
          当サイトに掲載している見出し・要約の著作権は、各媒体に帰属します。掲載方針は
          <Link href="/about" className="text-accent underline">運営方針</Link>
          をご覧ください。掲載情報の正確性には努めますが、その内容を保証するものではありません。
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">8. 改定</h2>
        <p>このポリシーは、法令の変更やサービスの変更に応じて改定することがあります。改定した場合は、このページでお知らせします。</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">9. お問い合わせ</h2>
        <p>
          このポリシーに関するお問い合わせは、
          <a href={`mailto:${siteConfig.contactEmail}`} className="text-accent underline">{siteConfig.contactEmail}</a>
          までご連絡ください。
        </p>
      </section>
    </article>
  );
}
